const School = require('../models/School');
const { scopeSchoolId } = require('./resourceAuthorization');

const requestedSchoolId = req => scopeSchoolId(
  req.user,
  req.body?.schoolId || req.query?.schoolId
);

// Use on state-changing operational routes. Historical reads intentionally do
// not use this guard so authorized platform staff can still inspect records.
const requireActiveOrganization = async (req, res, next) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'Organization context is required' });
    }
    const organization = req.organization && String(req.organization._id) === String(schoolId)
      ? req.organization
      : await School.findOne({ _id: schoolId }).select('_id isActive');
    if (!organization || organization.isActive === false) {
      return res.status(409).json({ success: false, message: 'Organization is deactivated' });
    }
    req.organization = organization;
    next();
  } catch (_error) {
    return res.status(409).json({ success: false, message: 'Organization is unavailable' });
  }
};

module.exports = { requireActiveOrganization };
