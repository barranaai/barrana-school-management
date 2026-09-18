const ACCOUNT_TYPES = Object.freeze(['organization', 'solo_practitioner']);

const ORGANIZATION_TYPES = Object.freeze([
  'school',
  'early_childhood_center',
  'training_academy',
  'sports_club',
  'arts_studio',
  'fitness_business',
  'tutoring_service',
  'independent_practice',
  'other'
]);

const TERMINOLOGY_PROFILES = Object.freeze(['education', 'training', 'coaching']);

const TERMINOLOGY = Object.freeze({
  education: Object.freeze({
    workspace: 'School',
    administrator: 'School Administrator',
    trainer: 'Teacher',
    participant: 'Student',
    guardian: 'Parent',
    group: 'Class'
  }),
  training: Object.freeze({
    workspace: 'Organization',
    administrator: 'Organization Administrator',
    trainer: 'Trainer',
    participant: 'Participant',
    guardian: 'Guardian',
    group: 'Group'
  }),
  coaching: Object.freeze({
    workspace: 'Practice',
    administrator: 'Owner',
    trainer: 'Coach',
    participant: 'Client',
    guardian: 'Guardian',
    group: 'Group'
  })
});

const defaultOrganizationType = accountType =>
  accountType === 'solo_practitioner' ? 'independent_practice' : 'school';

const defaultTerminologyProfile = accountType =>
  accountType === 'solo_practitioner' ? 'coaching' : 'education';

const resolveWorkspaceProfile = workspace => {
  const accountType = ACCOUNT_TYPES.includes(workspace?.accountType)
    ? workspace.accountType
    : 'organization';
  const organizationType = ORGANIZATION_TYPES.includes(workspace?.organizationType)
    ? workspace.organizationType
    : defaultOrganizationType(accountType);
  const terminologyProfile = TERMINOLOGY_PROFILES.includes(workspace?.terminologyProfile)
    ? workspace.terminologyProfile
    : defaultTerminologyProfile(accountType);

  return {
    accountType,
    organizationType,
    terminologyProfile,
    terminology: TERMINOLOGY[terminologyProfile]
  };
};

module.exports = {
  ACCOUNT_TYPES,
  ORGANIZATION_TYPES,
  TERMINOLOGY_PROFILES,
  TERMINOLOGY,
  defaultOrganizationType,
  defaultTerminologyProfile,
  resolveWorkspaceProfile
};
