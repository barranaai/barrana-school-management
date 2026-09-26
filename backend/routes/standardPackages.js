const express = require('express');
const mongoose = require('mongoose');
const { protect, protectReadOnly, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const { ORGANIZATION_TYPES } = require('../domain/workspaceProfile');
const School = require('../models/School');
const StandardPackage = require('../models/StandardPackage');
const StandardPackageAdoption = require('../models/StandardPackageAdoption');
const { validateDefinition, adoptPackage } = require('../services/standardPackageService');

const router = express.Router();
const validId = value => mongoose.Types.ObjectId.isValid(value);
const admins = ['school_admin', 'super_admin'];
const error = (res, caught) => {
  if (caught.code === 11000) {
    return res.status(409).json({ success: false, message: 'Package slug and version already exist' });
  }
  if (caught.code === 'DUPLICATE_ADOPTION') {
    return res.status(409).json({ success: false, message: 'This organization has already adopted this package' });
  }
  if (caught.code === 'INVALID_PACKAGE' || caught.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Standard Package information is invalid' });
  }
  return res.status(500).json({ success: false, message: 'Standard Package operation failed' });
};

const invalidInput = message => Object.assign(new Error(message), {
  statusCode: 400,
  code: 'INVALID_PACKAGE'
});

function exactBody(body, allowed) {
  const unsupported = Object.keys(body || {}).filter(key => !allowed.has(key));
  if (unsupported.length) throw invalidInput('Package request contains unsupported fields');
}

function validateOrganizationTypes(values) {
  if (!Array.isArray(values)) throw invalidInput('Organization types must be an array');
  if (values.some(value => !ORGANIZATION_TYPES.includes(value))) {
    throw invalidInput('Package contains an unsupported organization type');
  }
}

function createPayload(body) {
  exactBody(body, new Set(['slug', 'name', 'description', 'version', 'organizationTypes', 'definition']));
  if (!body.name || typeof body.name !== 'string') throw invalidInput('Package name is required');
  if (!body.slug || typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) {
    throw invalidInput('Package slug must use lowercase letters, numbers and hyphens');
  }
  if (!Number.isInteger(body.version) || body.version < 1) throw invalidInput('Package version must be a positive integer');
  validateOrganizationTypes(body.organizationTypes || []);
  validateDefinition(body.definition);
  return {
    slug: body.slug,
    name: body.name,
    description: body.description,
    version: body.version,
    organizationTypes: body.organizationTypes || [],
    definition: body.definition
  };
}

function updatePayload(body) {
  exactBody(body, new Set(['name', 'description', 'organizationTypes', 'definition']));
  if (Object.hasOwn(body, 'name') && (!body.name || typeof body.name !== 'string')) {
    throw invalidInput('Package name is required');
  }
  if (Object.hasOwn(body, 'organizationTypes')) validateOrganizationTypes(body.organizationTypes);
  if (Object.hasOwn(body, 'definition')) validateDefinition(body.definition);
  return body;
}

router.get('/', protectReadOnly, authorize(...admins), async (req, res) => {
  try {
    const query = req.user.role === 'super_admin' && req.query.includeDrafts === 'true'
      ? {}
      : { status: 'published' };
    const data = await StandardPackage.find(query)
      .sort({ slug: 1, version: -1 })
      .select('-definition');
    res.json({ success: true, data });
  } catch (caught) {
    error(res, caught);
  }
});

router.get('/adoptions', protectReadOnly, authorize(...admins), async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.query.schoolId);
    if (!validId(schoolId)) return res.status(400).json({ success: false, message: 'Explicit valid schoolId is required' });
    const data = await StandardPackageAdoption.find({ schoolId })
      .populate('packageId', 'name slug version status')
      .sort({ adoptedAt: -1 });
    res.json({ success: true, data });
  } catch (caught) {
    error(res, caught);
  }
});

router.get('/:id', protectReadOnly, authorize(...admins), async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Standard package not found' });
    const query = { _id: req.params.id };
    if (req.user.role !== 'super_admin') query.status = 'published';
    const data = await StandardPackage.findOne(query);
    if (!data) return res.status(404).json({ success: false, message: 'Standard package not found' });
    res.json({ success: true, data });
  } catch (caught) {
    error(res, caught);
  }
});

router.post('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const body = createPayload(req.body || {});
    const data = await StandardPackage.create({
      ...body,
      status: 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    res.status(201).json({ success: true, data });
  } catch (caught) {
    error(res, caught);
  }
});

router.put('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Standard package not found' });
    const current = await StandardPackage.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Standard package not found' });
    if (current.status !== 'draft') return res.status(409).json({ success: false, message: 'Published or retired packages are immutable' });
    const body = updatePayload(req.body || {});
    for (const key of ['name', 'description', 'organizationTypes', 'definition']) {
      if (Object.hasOwn(body, key)) current[key] = body[key];
    }
    current.updatedBy = req.user._id;
    await current.save();
    res.json({ success: true, data: current });
  } catch (caught) {
    error(res, caught);
  }
});

router.patch('/:id/publish', protect, authorize('super_admin'), async (req, res) => {
  try {
    exactBody(req.body || {}, new Set());
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Standard package not found' });
    const current = await StandardPackage.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Standard package not found' });
    if (current.status !== 'draft') return res.status(409).json({ success: false, message: 'Only draft packages can be published' });
    validateOrganizationTypes(current.organizationTypes || []);
    validateDefinition(current.definition);
    current.status = 'published';
    current.publishedAt = new Date();
    current.updatedBy = req.user._id;
    await current.save();
    res.json({ success: true, data: current });
  } catch (caught) {
    error(res, caught);
  }
});

router.post('/:id/adopt', protect, authorize(...admins), async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.body.schoolId);
    if (!validId(schoolId)) return res.status(400).json({ success: false, message: 'Explicit valid schoolId is required' });
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Standard package not found' });
    const [school, pkg] = await Promise.all([
      School.findOne({ _id: schoolId, isActive: { $ne: false } }),
      StandardPackage.findOne({ _id: req.params.id, status: 'published' })
    ]);
    if (!school || !pkg) return res.status(404).json({ success: false, message: 'Organization or standard package not found' });
    const data = await adoptPackage({ packageDocument: pkg, schoolId, userId: req.user._id });
    res.status(201).json({ success: true, data });
  } catch (caught) {
    error(res, caught);
  }
});

module.exports = router;
