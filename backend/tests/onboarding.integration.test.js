const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { integrationUri } = require('../config/integrationDatabase');
const { openIntegrationHarness } = require('./helpers/integrationHarness');

test('onboarding creates isolated workspaces atomically with blank or standard setup', { timeout: 120000 }, async () => {
  const target = new URL(integrationUri());
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '27018');
  process.env.JWT_SECRET = crypto.randomUUID();
  process.env.ENABLE_SCHEDULERS = 'false';
  process.env.ENABLE_DEBUG_ROUTES = 'false';

  const h = await openIntegrationHarness();
  const run = crypto.randomUUID();
  const prefix = `onboarding-${run}`;
  try {
    await h.verify();
    const {
      OnboardingRequest, School, User, StandardPackage, StandardPackageAdoption,
      Program, Level, Requirement, Parameter, Roadmap, PlannedSession
    } = h.models;
    await Promise.all([
      OnboardingRequest.createCollection(), StandardPackage.createCollection(),
      StandardPackageAdoption.createCollection(), Roadmap.createCollection()
    ]);
    await Promise.all([
      OnboardingRequest.createIndexes(), StandardPackage.createIndexes(),
      StandardPackageAdoption.createIndexes(), Roadmap.createIndexes()
    ]);
    const {
      hashToken, issueOnboardingRequest, validateOnboardingToken, completeOnboarding
    } = require('../services/onboardingService');

    const issued = await issueOnboardingRequest({
      firstName: 'Issued', lastName: 'Owner', email: `${prefix}-issued@EXAMPLE.INVALID`
    });
    assert.equal(issued.shouldSend, true);
    const storedIssued = await OnboardingRequest.findOne({ normalizedEmail: `${prefix}-issued@example.invalid` })
      .select('+tokenHash');
    assert.equal(storedIssued.tokenHash, hashToken(issued.token));
    assert.notEqual(storedIssued.tokenHash, issued.token);
    const resent = await issueOnboardingRequest({ email: issued.email, resend: true });
    assert.equal(resent.shouldSend, true);
    assert.notEqual(resent.token, issued.token);
    await assert.rejects(() => validateOnboardingToken(issued.token), error => error.code === 'INVALID_ONBOARDING_TOKEN');
    assert.ok(await validateOnboardingToken(resent.token));

    async function requestFor(label, options = {}) {
      const token = crypto.randomBytes(32).toString('hex');
      const normalizedEmail = `${prefix}-${label}@example.invalid`;
      const request = await OnboardingRequest.create({
        normalizedEmail,
        firstName: 'Test',
        lastName: label,
        tokenHash: hashToken(token),
        expiresAt: options.expiresAt || new Date(Date.now() + 60 * 60 * 1000),
        consumedAt: options.consumedAt || null,
        invalidatedAt: options.invalidatedAt || null
      });
      return { token, normalizedEmail, request };
    }

    const expired = await requestFor('expired', { expiresAt: new Date(Date.now() - 1000) });
    const used = await requestFor('used', { consumedAt: new Date() });
    await assert.rejects(() => validateOnboardingToken(expired.token), error => error.code === 'INVALID_ONBOARDING_TOKEN');
    await assert.rejects(() => validateOnboardingToken(used.token), error => error.code === 'INVALID_ONBOARDING_TOKEN');
    await assert.rejects(() => validateOnboardingToken('invalid-token'), error => error.code === 'INVALID_ONBOARDING_TOKEN');

    const blank = await requestFor('organization-blank');
    const blankResult = await completeOnboarding({
      token: blank.token,
      password: 'strong-test-password',
      accountType: 'organization',
      organizationType: 'sports_club',
      workspaceName: 'Atomic Sports Club',
      estimatedParticipants: 30,
      role: 'super_admin',
      schoolId: new h.connection.base.Types.ObjectId(),
      ownerUserId: new h.connection.base.Types.ObjectId(),
      terminologyProfile: 'education'
    });
    assert.equal(blankResult.workspace.accountType, 'organization');
    assert.equal(blankResult.workspace.organizationType, 'sports_club');
    assert.equal(blankResult.workspace.terminologyProfile, 'training');
    assert.equal(blankResult.owner.role, 'school_admin');
    assert.equal(String(blankResult.owner.schoolId), String(blankResult.workspace._id));
    assert.equal(String(blankResult.workspace.ownerUserId), String(blankResult.owner._id));
    assert.equal(await Program.countDocuments({ schoolId: blankResult.workspace._id }), 0);
    assert.ok(await OnboardingRequest.findOne({ _id: blank.request._id, consumedAt: { $ne: null } }));
    await assert.rejects(() => completeOnboarding({
      token: blank.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Duplicate Workspace'
    }), error => error.code === 'INVALID_ONBOARDING_TOKEN');

    const solo = await requestFor('solo-blank');
    const soloResult = await completeOnboarding({
      token: solo.token,
      password: 'strong-test-password',
      accountType: 'solo_practitioner',
      organizationType: 'school',
      workspaceName: 'Solo Music Practice'
    });
    assert.equal(soloResult.workspace.accountType, 'solo_practitioner');
    assert.equal(soloResult.workspace.organizationType, 'independent_practice');
    assert.equal(soloResult.workspace.terminologyProfile, 'coaching');
    assert.equal(soloResult.owner.role, 'school_admin');

    const customMissing = await requestFor('custom-missing');
    await assert.rejects(() => completeOnboarding({
      token: customMissing.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'other', workspaceName: 'Custom Organization'
    }), error => error.code === 'CUSTOM_ORGANIZATION_TYPE_REQUIRED');
    assert.equal(await School.countDocuments({ 'contactPerson.email': customMissing.normalizedEmail }), 0);
    assert.equal((await OnboardingRequest.findById(customMissing.request._id)).consumedAt, null);

    const custom = await requestFor('custom-valid');
    const customResult = await completeOnboarding({
      token: custom.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'other', customOrganizationTypeLabel: 'Children Coding Club',
      workspaceName: 'Custom Skills Organization'
    });
    assert.equal(customResult.workspace.customOrganizationTypeLabel, 'Children Coding Club');

    const definition = { programs: [{
      key: 'swim', name: 'Swimming', levels: [{
        key: 'water', name: 'Water Confidence', requirements: [{
          key: 'entry', name: 'Safe Entry', parameters: [{ key: 'confidence', name: 'Confidence', type: 'rating' }]
        }]
      }],
      roadmaps: [{
        key: 'water-roadmap', levelKey: 'water', name: 'Water Confidence Roadmap',
        plannedSessions: [{ sequence: 1, title: 'Safe Entry', objectives: [{ title: 'Safe entry', requirementKey: 'entry', parameterKey: 'confidence' }] }]
      }]
    }] };
    const creatorId = new h.connection.base.Types.ObjectId();
    const compatiblePackage = await StandardPackage.create({
      slug: `${prefix}-compatible`, name: 'Compatible Package', version: 1,
      status: 'published', organizationTypes: ['sports_club'], definition,
      createdBy: creatorId, updatedBy: creatorId, publishedAt: new Date()
    });
    const packageRequest = await requestFor('package');
    const packageResult = await completeOnboarding({
      token: packageRequest.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Package Sports Club',
      standardPackageId: compatiblePackage._id
    });
    assert.ok(packageResult.adoption);
    assert.equal(String(packageResult.adoption.schoolId), String(packageResult.workspace._id));
    const copiedProgram = await Program.findOne({ schoolId: packageResult.workspace._id });
    assert.equal(copiedProgram.name, 'Swimming');
    assert.equal(String(copiedProgram.metadata.standardPackage.packageId), String(compatiblePackage._id));
    const sourceAfterAdoption = await StandardPackage.findById(compatiblePackage._id);
    assert.equal(sourceAfterAdoption.definition.programs[0].name, 'Swimming');

    for (const [label, status, organizationType, expectedCode] of [
      ['incompatible', 'published', 'arts_studio', 'PACKAGE_INCOMPATIBLE'],
      ['draft', 'draft', 'sports_club', 'PACKAGE_UNAVAILABLE'],
      ['retired', 'retired', 'sports_club', 'PACKAGE_UNAVAILABLE']
    ]) {
      const candidate = status === 'published' ? compatiblePackage : await StandardPackage.create({
        slug: `${prefix}-${label}`, name: `${label} Package`, version: 1,
        status, organizationTypes: ['sports_club'], definition, createdBy: creatorId, updatedBy: creatorId
      });
      const pending = await requestFor(label);
      await assert.rejects(() => completeOnboarding({
        token: pending.token, password: 'strong-test-password', accountType: 'organization',
        organizationType, workspaceName: `${label} Workspace`, standardPackageId: candidate._id
      }), error => error.code === expectedCode);
      assert.equal(await School.countDocuments({ 'contactPerson.email': pending.normalizedEmail }), 0);
      assert.equal((await OnboardingRequest.findById(pending.request._id)).consumedAt, null);
    }

    const ownerFailure = await requestFor('owner-failure');
    await assert.rejects(() => completeOnboarding({
      token: ownerFailure.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Owner Failure Workspace', phone: 'not-e164'
    }));
    assert.equal(await School.countDocuments({ 'contactPerson.email': ownerFailure.normalizedEmail }), 0);
    assert.equal(await User.countDocuments({ email: ownerFailure.normalizedEmail }), 0);
    assert.equal((await OnboardingRequest.findById(ownerFailure.request._id)).consumedAt, null);

    const brokenDefinition = JSON.parse(JSON.stringify(definition));
    brokenDefinition.programs[0].roadmaps.push({
      ...brokenDefinition.programs[0].roadmaps[0], key: 'duplicate-roadmap'
    });
    const brokenPackage = await StandardPackage.create({
      slug: `${prefix}-broken`, name: 'Broken Package', version: 1,
      status: 'published', organizationTypes: ['sports_club'], definition: brokenDefinition,
      createdBy: creatorId, updatedBy: creatorId, publishedAt: new Date()
    });
    const adoptionFailure = await requestFor('adoption-failure');
    await assert.rejects(() => completeOnboarding({
      token: adoptionFailure.token, password: 'strong-test-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Adoption Failure Workspace',
      standardPackageId: brokenPackage._id
    }));
    assert.equal(await School.countDocuments({ 'contactPerson.email': adoptionFailure.normalizedEmail }), 0);
    assert.equal(await User.countDocuments({ email: adoptionFailure.normalizedEmail }), 0);
    assert.equal((await OnboardingRequest.findById(adoptionFailure.request._id)).consumedAt, null);
  } finally {
    const m = h.models;
    const schools = await m.School.find({ 'contactPerson.email': { $regex: `^${prefix}` } }).select('_id');
    const schoolIds = schools.map(school => school._id);
    for (const name of ['PlannedSession', 'Roadmap', 'Parameter', 'Requirement', 'Level', 'Program', 'StandardPackageAdoption']) {
      if (m[name]) await m[name].deleteMany({ schoolId: { $in: schoolIds } });
    }
    await m.User.deleteMany({ email: { $regex: `^${prefix}` } });
    await m.School.deleteMany({ _id: { $in: schoolIds } });
    await m.StandardPackage.deleteMany({ slug: { $regex: `^${prefix}` } });
    await m.OnboardingRequest.deleteMany({ normalizedEmail: { $regex: `^${prefix}` } });
    await h.close();
  }
});
