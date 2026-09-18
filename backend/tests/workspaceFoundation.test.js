const test = require('node:test');
const assert = require('node:assert/strict');
const School = require('../models/School');
const {
  resolveWorkspaceProfile,
  TERMINOLOGY
} = require('../domain/workspaceProfile');

const legacySchool = () => ({
  name: 'Existing Academy',
  slug: 'existing-academy',
  schoolType: 'montessori_school',
  estimatedStudents: 10,
  address: {
    street: '1 Main Street',
    city: 'Toronto',
    state: 'ON',
    zipCode: 'A1A 1A1',
    country: 'Canada'
  },
  contactPerson: {
    name: 'Test Administrator',
    email: 'admin@example.invalid'
  }
});

test('existing school records receive backward-compatible workspace defaults', async () => {
  const school = new School(legacySchool());
  await school.validate();

  assert.equal(school.accountType, 'organization');
  assert.equal(school.organizationType, 'school');
  assert.equal(school.terminologyProfile, 'education');
  assert.deepEqual(school.workspaceProfile.terminology, TERMINOLOGY.education);
  assert.equal(school.fullAddress, '1 Main Street, Toronto, ON A1A 1A1, Canada');
});

test('solo practitioner is valid without fabricated school details', async () => {
  const practice = new School({
    name: 'Taylor Music Coaching',
    slug: 'taylor-music-coaching',
    accountType: 'solo_practitioner',
    organizationType: 'independent_practice',
    terminologyProfile: 'coaching',
    estimatedParticipants: 8,
    contactPerson: {
      name: 'Taylor Trainer',
      email: 'taylor@example.invalid'
    }
  });

  await practice.validate();
  assert.equal(practice.schoolType, undefined);
  assert.equal(practice.estimatedStudents, undefined);
  assert.equal(practice.fullAddress, null);
  assert.deepEqual(practice.workspaceProfile.terminology, TERMINOLOGY.coaching);
});

test('training organizations use neutral terminology without changing tenant identity', async () => {
  const academy = new School({
    name: 'Community Swim Club',
    slug: 'community-swim-club',
    accountType: 'organization',
    organizationType: 'sports_club',
    terminologyProfile: 'training',
    estimatedParticipants: 40,
    contactPerson: {
      name: 'Club Administrator',
      email: 'club@example.invalid'
    }
  });

  await academy.validate();
  assert.equal(academy.schoolType, undefined);
  assert.equal(academy.workspaceProfile.terminology.trainer, 'Trainer');
  assert.equal(academy.workspaceProfile.terminology.participant, 'Participant');
});

test('invalid workspace classifications fail closed', async () => {
  const invalid = new School({
    ...legacySchool(),
    accountType: 'unrecognized_account_type'
  });

  await assert.rejects(invalid.validate(), /accountType/);
});

test('plain legacy data resolves safely without a database migration', () => {
  assert.deepEqual(resolveWorkspaceProfile({}), {
    accountType: 'organization',
    organizationType: 'school',
    terminologyProfile: 'education',
    terminology: TERMINOLOGY.education
  });
});
