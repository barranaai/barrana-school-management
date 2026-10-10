import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import StandardPackageCatalogManagement from './StandardPackageCatalogManagement';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/apiService';
import { standardPackageService } from '../../services/standardPackageService';
import { activityPackageBlueprints, copyActivityPackageBlueprint } from '../../domain/activityPackageBlueprints';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/standardPackageService', () => {
  const actual = jest.requireActual('../../services/standardPackageService');
  return { ...actual, standardPackageService: jest.fn() };
});

const draft = {
  _id: 'draft-1', slug: 'music-foundation', name: 'Music Foundation', version: 1,
  status: 'draft' as const, organizationTypes: ['arts_studio'],
  createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z',
  definition: { programs: [{ key: 'music', name: 'Music', levels: [], roadmaps: [] }] }
};
const published = { ...draft, _id: 'published-1', version: 2, status: 'published' as const, publishedAt: '2026-09-18T00:00:00.000Z' };
const retired = { ...draft, _id: 'retired-1', version: 3, status: 'retired' as const };
const catalogApi = {
  listCatalog: jest.fn(), get: jest.fn(), createDraft: jest.fn(),
  updateDraft: jest.fn(), publish: jest.fn()
};

let root: Root;
let host: HTMLDivElement;
const step = async (action?: () => void) => { await act(async () => { if (action) action(); }); };
const button = (text: string, index = 0) => {
  const matches = Array.from(document.querySelectorAll('button')).filter(item => item.textContent?.trim() === text);
  if (!matches[index]) throw new Error(`Button not found: ${text}`);
  return matches[index] as HTMLButtonElement;
};
const field = (label: string) => {
  const target = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.replace(' *', '').trim() === label);
  if (!target?.htmlFor) throw new Error(`Field not found: ${label}`);
  return document.getElementById(target.htmlFor) as HTMLInputElement;
};

beforeEach(() => {
  jest.clearAllMocks();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'super_admin' }, token: 'platform-token' });
  (standardPackageService as jest.Mock).mockReturnValue(catalogApi);
  catalogApi.listCatalog.mockResolvedValue([draft, published, retired]);
  catalogApi.get.mockImplementation((id: string) => Promise.resolve([draft, published, retired].find(item => item._id === id)));
  catalogApi.createDraft.mockResolvedValue(draft);
  catalogApi.updateDraft.mockResolvedValue(draft);
  catalogApi.publish.mockResolvedValue(published);
  jest.spyOn(apiService, 'getOnboardingMetadata').mockResolvedValue({
    success: true,
    data: {
      accountTypes: [], schoolTypes: [],
      organizationTypes: [
        { value: 'school', label: 'School', accountTypes: ['organization'], requiresSchoolDetails: true },
        { value: 'arts_studio', label: 'Arts Studio', accountTypes: ['organization'], requiresSchoolDetails: false }
      ]
    }
  } as any);
});

afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

const renderCatalog = async () => { await step(() => root.render(<StandardPackageCatalogManagement />)); };

test('blocks non-platform administrators before loading the catalog', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'school_admin' }, token: 'school-token' });
  await renderCatalog();
  expect(document.body).toHaveTextContent('Platform Administrator access required.');
  expect(catalogApi.listCatalog).not.toHaveBeenCalled();
});

test('shows grouped package versions and lifecycle actions only for drafts', async () => {
  await renderCatalog();
  expect(document.body).toHaveTextContent('Standard Packages');
  expect(document.body).toHaveTextContent('draft');
  expect(document.body).toHaveTextContent('published');
  expect(document.body).toHaveTextContent('retired');
  expect(document.body).toHaveTextContent('Created');
  expect(document.body).toHaveTextContent('Updated');
  expect(Array.from(document.querySelectorAll('button')).filter(item => item.textContent?.trim() === 'Edit')).toHaveLength(1);
  expect(Array.from(document.querySelectorAll('button')).filter(item => item.textContent?.trim() === 'Publish')).toHaveLength(1);
});

test('creates a structured draft without a raw JSON editor', async () => {
  await renderCatalog();
  await step(() => Simulate.click(button('Create Blank Package')));
  expect(document.body.textContent).not.toContain('JSON');

  await step(() => Simulate.change(field('Package name'), { target: { value: 'Piano Foundation' } }));
  await step(() => Simulate.change(field('Slug'), { target: { value: 'Piano Foundation' } }));
  const arts = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.trim() === 'Arts Studio')?.querySelector('input');
  await step(() => Simulate.change(arts as HTMLInputElement, { target: { checked: true } }));
  await step(() => Simulate.click(button('Continue')));

  await step(() => Simulate.click(button('Add Program')));
  await step(() => Simulate.change(field('Program name'), { target: { value: 'Piano' } }));
  await step(() => Simulate.click(button('Add Level')));
  await step(() => Simulate.change(field('Level name'), { target: { value: 'Beginner' } }));
  await step(() => Simulate.click(button('Continue')));

  await step(() => Simulate.click(button('Add Requirement')));
  await step(() => Simulate.change(field('Requirement name'), { target: { value: 'Playing posture' } }));
  await step(() => Simulate.click(button('Add Parameter')));
  await step(() => Simulate.change(field('Parameter name'), { target: { value: 'Posture rating' } }));
  await step(() => Simulate.click(button('Continue')));

  await step(() => Simulate.click(button('Add Roadmap')));
  await step(() => Simulate.change(field('Roadmap name'), { target: { value: 'Beginner Piano Roadmap' } }));
  await step(() => Simulate.click(button('Add Planned Session')));
  await step(() => Simulate.change(field('Session title'), { target: { value: 'Sitting at the piano' } }));
  await step(() => Simulate.click(button('Add Objective')));
  await step(() => Simulate.change(field('Objective title'), { target: { value: 'Demonstrate balanced posture' } }));
  await step(() => Simulate.click(button('Continue')));
  expect(document.body).toHaveTextContent('Program: Piano');
  expect(document.body).toHaveTextContent('Level: Beginner');
  expect(document.body).toHaveTextContent('Requirement: Playing posture');
  expect(document.body).toHaveTextContent('Roadmap: Beginner Piano Roadmap');
  expect(document.body).toHaveTextContent('Session 1: Sitting at the piano');
  await step(() => Simulate.click(button('Save Draft')));

  expect(catalogApi.createDraft).toHaveBeenCalledWith(expect.objectContaining({
    slug: 'piano-foundation', name: 'Piano Foundation', version: 1,
    organizationTypes: ['arts_studio'],
    definition: { programs: [expect.objectContaining({
      name: 'Piano',
      levels: [expect.objectContaining({ name: 'Beginner' })],
      roadmaps: [expect.objectContaining({ name: 'Beginner Piano Roadmap' })]
    })] }
  }));
});

test('loads a draft for editing and publishes only after confirmation', async () => {
  await renderCatalog();
  await step(() => Simulate.click(button('Edit')));
  expect(document.body).toHaveTextContent('Edit Standard Package Draft');
  expect(field('Slug')).toBeDisabled();
  await step(() => Simulate.click(button('Back to catalog')));

  await step(() => Simulate.click(button('Publish')));
  expect(document.body).toHaveTextContent('Publish Standard Package?');
  await step(() => Simulate.click(button('Confirm Publish')));
  expect(catalogApi.publish).toHaveBeenCalledWith('draft-1');
});

test.each(activityPackageBlueprints.map(blueprint => [blueprint.name, blueprint.slug] as const))(
  'loads, edits, saves and publishes %s through the normal catalog workflow',
  async (name, slug) => {
    const expected = copyActivityPackageBlueprint(slug)!;
    const originalProgramName = expected.definition.programs[0].name;
    const editedProgramName = `${originalProgramName} — Organization Ready`;
    let saved: any;
    catalogApi.createDraft.mockImplementation(async input => {
      saved = {
        ...input, _id: `draft-${slug}`, status: 'draft',
        createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z'
      };
      catalogApi.listCatalog.mockResolvedValue([saved]);
      return saved;
    });

    await renderCatalog();
    await step(() => Simulate.click(button(`Use ${name}`)));
    expect(field('Package name')).toHaveValue(name);
    expect(field('Slug')).toHaveValue(slug);

    await step(() => Simulate.click(button('Continue')));
    expect(field('Program name')).toHaveValue(originalProgramName);
    const inputValues = Array.from(document.querySelectorAll('input')).map(input => input.value);
    expect(inputValues).toEqual(expect.arrayContaining(expected.definition.programs[0].levels.map(level => level.name)));
    await step(() => Simulate.change(field('Program name'), { target: { value: editedProgramName } }));
    expect(activityPackageBlueprints.find(item => item.slug === slug)?.definition.programs[0].name).toBe(originalProgramName);

    await step(() => Simulate.click(button('Continue')));
    await step(() => Simulate.click(button('Continue')));
    await step(() => Simulate.click(button('Continue')));
    expected.definition.programs[0].name = editedProgramName;
    await step(() => Simulate.click(button('Save Draft')));

    expect(catalogApi.createDraft).toHaveBeenCalledWith(expected);
    const submitted = catalogApi.createDraft.mock.calls[0][0];
    for (const program of submitted.definition.programs) {
      for (const level of program.levels) {
        const roadmap = program.roadmaps.find((item: any) => item.levelKey === level.key);
        expect(roadmap).toBeDefined();
        for (const session of roadmap.plannedSessions) {
          for (const objective of session.objectives) {
            const requirement = level.requirements.find((item: any) => item.key === objective.requirementKey);
            expect(requirement).toBeDefined();
            expect(requirement.parameters.some((item: any) => item.key === objective.parameterKey)).toBe(true);
          }
        }
      }
    }

    expect(document.body).toHaveTextContent(name);
    await step(() => Simulate.click(button('Publish')));
    await step(() => Simulate.click(button('Confirm Publish')));
    expect(catalogApi.publish).toHaveBeenCalledWith(`draft-${slug}`);
  }
);

test('view mode renders hierarchy details without edit controls', async () => {
  await renderCatalog();
  await step(() => Simulate.click(button('View', 1)));
  expect(document.body).toHaveTextContent('Standard Package Review');
  expect(document.body).toHaveTextContent('Program: Music');
  expect(document.body.textContent).not.toContain('Save Draft');
});



test('shows validation errors before leaving incomplete package details', async () => {
  await renderCatalog();
  await step(() => Simulate.click(button('Create Blank Package')));
  await step(() => Simulate.click(button('Continue')));
  expect(document.body).toHaveTextContent('Enter a name, lowercase hyphenated slug and positive version.');
  expect(document.body).toHaveTextContent('Package Details');
  expect(field('Package name')).toBeInTheDocument();
});
