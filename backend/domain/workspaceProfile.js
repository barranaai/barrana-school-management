const ACCOUNT_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({
    value: 'organization',
    label: 'Organization',
    description: 'For an academy, club, studio, school, center or other team.'
  }),
  Object.freeze({
    value: 'solo_practitioner',
    label: 'Solo Practitioner',
    description: 'For an independent trainer, coach, tutor or instructor.'
  })
]);

const ORGANIZATION_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ value: 'school', label: 'School', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: true }),
  Object.freeze({ value: 'early_childhood_center', label: 'Early childhood center', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: true }),
  Object.freeze({ value: 'training_academy', label: 'Training academy', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'sports_club', label: 'Sports club', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'arts_studio', label: 'Arts studio', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'fitness_business', label: 'Fitness business', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'tutoring_service', label: 'Tutoring service', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'independent_practice', label: 'Independent practice', accountTypes: Object.freeze(['solo_practitioner']), requiresSchoolDetails: false }),
  Object.freeze({ value: 'other', label: 'Other', accountTypes: Object.freeze(['organization']), requiresSchoolDetails: false })
]);

const SCHOOL_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ value: 'licensed_daycare', label: 'Licensed daycare' }),
  Object.freeze({ value: 'montessori_school', label: 'Montessori school' }),
  Object.freeze({ value: 'public_private_school', label: 'Public or private school' })
]);

const ACCOUNT_TYPES = Object.freeze(ACCOUNT_TYPE_DEFINITIONS.map(item => item.value));
const ORGANIZATION_TYPES = Object.freeze(ORGANIZATION_TYPE_DEFINITIONS.map(item => item.value));
const SCHOOL_TYPES = Object.freeze(SCHOOL_TYPE_DEFINITIONS.map(item => item.value));

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

const organizationTypeRequiresSchoolDetails = organizationType =>
  ORGANIZATION_TYPE_DEFINITIONS.some(
    item => item.value === organizationType && item.requiresSchoolDetails === true
  );

const getPublicOnboardingMetadata = () => ({
  accountTypes: ACCOUNT_TYPE_DEFINITIONS.map(({ value, label, description }) => ({
    value,
    label,
    description
  })),
  organizationTypes: ORGANIZATION_TYPE_DEFINITIONS.map(
    ({ value, label, accountTypes, requiresSchoolDetails }) => ({
      value,
      label,
      accountTypes: [...accountTypes],
      requiresSchoolDetails
    })
  ),
  schoolTypes: SCHOOL_TYPE_DEFINITIONS.map(({ value, label }) => ({ value, label }))
});

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
    terminology: TERMINOLOGY[terminologyProfile],
    capabilities: {
      requiresAcademicGroupFields: organizationTypeRequiresSchoolDetails(organizationType)
    }
  };
};

module.exports = {
  ACCOUNT_TYPES,
  ORGANIZATION_TYPES,
  SCHOOL_TYPES,
  TERMINOLOGY_PROFILES,
  TERMINOLOGY,
  defaultOrganizationType,
  defaultTerminologyProfile,
  organizationTypeRequiresSchoolDetails,
  getPublicOnboardingMetadata,
  resolveWorkspaceProfile
};
