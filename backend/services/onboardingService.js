const crypto = require('node:crypto');
const mongoose = require('mongoose');
const OnboardingRequest = require('../models/OnboardingRequest');
const School = require('../models/School');
const User = require('../models/User');
const StandardPackage = require('../models/StandardPackage');
const { adoptPackageInSession } = require('./standardPackageService');
const {
  ACCOUNT_TYPES,
  ORGANIZATION_TYPES,
  SCHOOL_TYPES,
  organizationTypeRequiresSchoolDetails
} = require('../domain/workspaceProfile');

const PUBLIC_START_MESSAGE = 'If this email can be used, Kidsible has sent the next step.';
const TOKEN_TTL_MS = (Number.parseInt(process.env.ONBOARDING_TOKEN_TTL_HOURS, 10) || 24) * 60 * 60 * 1000;

class OnboardingError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'OnboardingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const hashToken = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const cleanText = value => String(value || '').trim().replace(/\s+/g, ' ');
const safeSlugRoot = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 70) || 'workspace';

function deriveWorkspaceProfile(accountType, requestedOrganizationType) {
  if (!ACCOUNT_TYPES.includes(accountType)) {
    throw new OnboardingError('INVALID_ACCOUNT_TYPE', 'Choose a valid account type.');
  }
  if (accountType === 'solo_practitioner') {
    return { accountType, organizationType: 'independent_practice', terminologyProfile: 'coaching' };
  }
  if (!ORGANIZATION_TYPES.includes(requestedOrganizationType) || requestedOrganizationType === 'independent_practice') {
    throw new OnboardingError('INVALID_ORGANIZATION_TYPE', 'Choose a valid organization type.');
  }
  return {
    accountType,
    organizationType: requestedOrganizationType,
    terminologyProfile: organizationTypeRequiresSchoolDetails(requestedOrganizationType) ? 'education' : 'training'
  };
}

function validateWorkspaceInput(input, profile) {
  const workspaceName = cleanText(input.workspaceName);
  if (workspaceName.length < 2 || workspaceName.length > 100) {
    throw new OnboardingError('INVALID_WORKSPACE_NAME', 'Workspace name must be between 2 and 100 characters.');
  }
  let customOrganizationTypeLabel;
  if (profile.organizationType === 'other') {
    customOrganizationTypeLabel = cleanText(input.customOrganizationTypeLabel);
    if (customOrganizationTypeLabel.length < 2 || customOrganizationTypeLabel.length > 100) {
      throw new OnboardingError('CUSTOM_ORGANIZATION_TYPE_REQUIRED', 'Enter a custom organization type.');
    }
  }
  if (!String(input.password || '').match(/^.{8,128}$/s)) {
    throw new OnboardingError('INVALID_PASSWORD', 'Password must be between 8 and 128 characters.');
  }

  const schoolDetails = {};
  if (organizationTypeRequiresSchoolDetails(profile.organizationType)) {
    if (!SCHOOL_TYPES.includes(input.schoolType)) {
      throw new OnboardingError('SCHOOL_DETAILS_REQUIRED', 'Choose a valid school type.');
    }
    if (!Number.isInteger(input.estimatedStudents) || input.estimatedStudents < 1) {
      throw new OnboardingError('SCHOOL_DETAILS_REQUIRED', 'Estimated students must be at least 1.');
    }
    const address = input.address || {};
    for (const field of ['street', 'city', 'state', 'zipCode', 'country']) {
      if (!cleanText(address[field])) {
        throw new OnboardingError('SCHOOL_DETAILS_REQUIRED', 'Complete the required school address.');
      }
    }
    schoolDetails.schoolType = input.schoolType;
    schoolDetails.estimatedStudents = input.estimatedStudents;
    schoolDetails.address = {
      street: cleanText(address.street), city: cleanText(address.city),
      state: cleanText(address.state), zipCode: cleanText(address.zipCode),
      country: cleanText(address.country)
    };
  }
  if (input.estimatedParticipants !== undefined &&
      (!Number.isInteger(input.estimatedParticipants) || input.estimatedParticipants < 0)) {
    throw new OnboardingError('INVALID_PARTICIPANT_COUNT', 'Estimated participants cannot be negative.');
  }
  return { workspaceName, customOrganizationTypeLabel, schoolDetails };
}

async function issueOnboardingRequest({ firstName, lastName, email, resend = false }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
  if (existingUser) return { shouldSend: false };

  let names = { firstName: cleanText(firstName), lastName: cleanText(lastName) };
  if (resend) {
    const current = await OnboardingRequest.findOne({
      normalizedEmail, consumedAt: null, invalidatedAt: null, expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();
    if (!current) return { shouldSend: false };
    names = { firstName: current.firstName, lastName: current.lastName };
  }

  const now = new Date();
  await OnboardingRequest.updateMany(
    { normalizedEmail, consumedAt: null, invalidatedAt: null },
    { $set: { invalidatedAt: now } }
  );
  const token = crypto.randomBytes(32).toString('hex');
  const request = await OnboardingRequest.create({
    normalizedEmail,
    firstName: names.firstName,
    lastName: names.lastName,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS)
  });
  return {
    shouldSend: true, token, firstName: request.firstName,
    email: request.normalizedEmail, expiresAt: request.expiresAt
  };
}

async function validateOnboardingToken(token, session) {
  if (!token || typeof token !== 'string') {
    throw new OnboardingError('INVALID_ONBOARDING_TOKEN', 'This onboarding link is invalid or expired.');
  }
  let query = OnboardingRequest.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
    consumedAt: null,
    invalidatedAt: null
  });
  if (session) query = query.session(session);
  const request = await query;
  if (!request) {
    throw new OnboardingError('INVALID_ONBOARDING_TOKEN', 'This onboarding link is invalid or expired.');
  }
  return request;
}

async function loadCompatiblePackage(packageId, organizationType, session) {
  if (!packageId) return null;
  if (!mongoose.isValidObjectId(packageId)) {
    throw new OnboardingError('PACKAGE_UNAVAILABLE', 'The selected Standard Package is unavailable.');
  }
  const pkg = await StandardPackage.findById(packageId).session(session);
  if (!pkg || pkg.status !== 'published' || pkg.schoolId) {
    throw new OnboardingError('PACKAGE_UNAVAILABLE', 'The selected Standard Package is unavailable.');
  }
  if (pkg.organizationTypes.length && !pkg.organizationTypes.includes(organizationType)) {
    throw new OnboardingError('PACKAGE_INCOMPATIBLE', 'The selected Standard Package is not compatible with this organization type.');
  }
  return pkg;
}

function isTransactionUnavailable(error) {
  return error?.code === 20 || error?.codeName === 'IllegalOperation' ||
    /transaction numbers are only allowed|replica set|transactions are not supported/i.test(String(error?.message || ''));
}

async function completeOnboarding(input) {
  const profile = deriveWorkspaceProfile(input.accountType, input.organizationType);
  const validated = validateWorkspaceInput(input, profile);
  let session;
  try {
    session = await OnboardingRequest.db.startSession();
    let result;
    await session.withTransaction(async () => {
      const request = await validateOnboardingToken(input.token, session);
      const existingUser = await User.findOne({ email: request.normalizedEmail }).session(session);
      if (existingUser) {
        throw new OnboardingError('EMAIL_UNAVAILABLE', 'This onboarding request can no longer be completed.');
      }
      const pkg = await loadCompatiblePackage(input.standardPackageId, profile.organizationType, session);
      const schoolId = new mongoose.Types.ObjectId();
      const ownerUserId = new mongoose.Types.ObjectId();
      const workspaceSlug = `${safeSlugRoot(validated.workspaceName)}-${crypto.randomBytes(5).toString('hex')}`;
      const contactName = `${request.firstName} ${request.lastName}`.trim();
      const workspaceData = {
        _id: schoolId,
        name: validated.workspaceName,
        slug: workspaceSlug,
        accountType: profile.accountType,
        organizationType: profile.organizationType,
        terminologyProfile: profile.terminologyProfile,
        customOrganizationTypeLabel: validated.customOrganizationTypeLabel,
        ownerUserId,
        contactPerson: {
          name: contactName,
          email: request.normalizedEmail,
          phone: cleanText(input.phone) || undefined,
          role: profile.accountType === 'solo_practitioner' ? 'Owner' : 'Administrator'
        },
        estimatedParticipants: input.estimatedParticipants,
        onboardingStatus: 'setup',
        onboardingSteps: { profileSetup: true, adminCreated: true },
        isActive: true,
        ...validated.schoolDetails
      };
      const [workspace] = await School.create([workspaceData], { session });
      const [owner] = await User.create([{
        _id: ownerUserId,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.normalizedEmail,
        password: input.password,
        role: 'school_admin',
        schoolId,
        phone: cleanText(input.phone) || undefined,
        isActive: true,
        isEmailVerified: true
      }], { session });

      let adoption = null;
      if (pkg) {
        adoption = await adoptPackageInSession({
          packageDocument: pkg, schoolId, userId: ownerUserId, session
        });
      }
      const consumed = await OnboardingRequest.updateOne(
        { _id: request._id, consumedAt: null, invalidatedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date() } },
        { session }
      );
      if (consumed.modifiedCount !== 1) {
        throw new OnboardingError('INVALID_ONBOARDING_TOKEN', 'This onboarding link is invalid or expired.');
      }
      result = { workspace, owner, adoption };
    });

    return {
      workspace: result.workspace,
      owner: result.owner,
      adoption: result.adoption,
      token: result.owner.generateAuthToken()
    };
  } catch (error) {
    if (isTransactionUnavailable(error)) {
      throw new OnboardingError('TRANSACTIONS_UNAVAILABLE', 'Workspace creation is temporarily unavailable.', 503);
    }
    if (error?.code === 11000) {
      throw new OnboardingError('ONBOARDING_CONFLICT', 'This onboarding request can no longer be completed.', 409);
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  PUBLIC_START_MESSAGE,
  OnboardingError,
  normalizeEmail,
  hashToken,
  deriveWorkspaceProfile,
  issueOnboardingRequest,
  validateOnboardingToken,
  completeOnboarding
};
