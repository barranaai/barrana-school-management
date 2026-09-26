const base = process.env.REACT_APP_API_URL || '/api';

export type StandardPackageStatus = 'draft' | 'published' | 'retired';
export type StandardParameterType = 'text' | 'rating' | 'percentage' | 'number' | 'checkbox' | 'select';

export interface StandardObjectiveDefinition {
  sequence?: number;
  title: string;
  description?: string;
  expectedOutcome?: string;
  instructionalGuidance?: string;
  requirementKey?: string;
  parameterKey?: string;
}

export interface StandardPlannedSessionDefinition {
  sequence: number;
  title: string;
  description?: string;
  expectedOutcomes?: string[];
  methodology?: string;
  objectives: StandardObjectiveDefinition[];
}

export interface StandardRoadmapDefinition {
  key: string;
  levelKey: string;
  name: string;
  description?: string;
  version?: number;
  methodology?: string;
  plannedSessions: StandardPlannedSessionDefinition[];
}

export interface StandardParameterDefinition {
  key: string;
  name: string;
  type: StandardParameterType;
  options?: string[];
  isRequired?: boolean;
  sequence?: number;
}

export interface StandardRequirementDefinition {
  key: string;
  name: string;
  description?: string;
  sequence?: number;
  isRequired?: boolean;
  parameters: StandardParameterDefinition[];
}

export interface StandardLevelDefinition {
  key: string;
  name: string;
  description?: string;
  sequence?: number;
  requirements: StandardRequirementDefinition[];
}

export interface StandardProgramDefinition {
  key: string;
  name: string;
  description?: string;
  displayOrder?: number;
  levels: StandardLevelDefinition[];
  roadmaps: StandardRoadmapDefinition[];
}

export interface StandardPackageDefinition {
  programs: StandardProgramDefinition[];
}

export interface StandardPackage {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  status: StandardPackageStatus;
  organizationTypes: string[];
  definition?: StandardPackageDefinition;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StandardPackageDraftInput {
  slug: string;
  name: string;
  description?: string;
  version: number;
  organizationTypes: string[];
  definition: StandardPackageDefinition;
}

export type StandardPackageDraftUpdate = Omit<StandardPackageDraftInput, 'slug' | 'version'>;

export interface StandardPackageAdoption {
  _id: string;
  schoolId: string;
  packageId: string | {
    _id: string;
    name: string;
    slug: string;
    version: number;
    status: string;
  };
  packageSlug: string;
  packageVersion: number;
  adoptedAt: string;
  status: 'completed';
}

export type StandardPackageErrorCode =
  | 'ALREADY_ADOPTED'
  | 'CONFLICT'
  | 'NOT_AUTHORIZED'
  | 'INVALID_PACKAGE'
  | 'NOT_FOUND'
  | 'REQUEST_FAILED';

export class StandardPackageServiceError extends Error {
  constructor(public readonly code: StandardPackageErrorCode) {
    super(code);
    this.name = 'StandardPackageServiceError';
  }
}

export function standardPackageService(token: string) {
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    conflictCode: StandardPackageErrorCode = 'CONFLICT'
  ): Promise<T> {
    try {
      const response = await fetch(base + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });

      if (!response.ok) {
        if (response.status === 400) throw new StandardPackageServiceError('INVALID_PACKAGE');
        if (response.status === 404) throw new StandardPackageServiceError('NOT_FOUND');
        if (response.status === 409) throw new StandardPackageServiceError(conflictCode);
        if (response.status === 401 || response.status === 403) {
          throw new StandardPackageServiceError('NOT_AUTHORIZED');
        }
        throw new StandardPackageServiceError('REQUEST_FAILED');
      }

      const result = await response.json();
      if (!result.success || (!Array.isArray(result.data) && result.data == null)) {
        throw new StandardPackageServiceError('REQUEST_FAILED');
      }
      return result.data;
    } catch (error) {
      if (error instanceof StandardPackageServiceError) throw error;
      throw new StandardPackageServiceError('REQUEST_FAILED');
    }
  }

  return {
    listPublished: () =>
      request<StandardPackage[]>('/standard-packages'),
    listCatalog: () =>
      request<StandardPackage[]>('/standard-packages?includeDrafts=true'),
    get: (packageId: string) =>
      request<StandardPackage>('/standard-packages/' + encodeURIComponent(packageId)),
    createDraft: (input: StandardPackageDraftInput) =>
      request<StandardPackage>('/standard-packages', 'POST', input),
    updateDraft: (packageId: string, input: StandardPackageDraftUpdate) =>
      request<StandardPackage>('/standard-packages/' + encodeURIComponent(packageId), 'PUT', input),
    publish: (packageId: string) =>
      request<StandardPackage>(
        '/standard-packages/' + encodeURIComponent(packageId) + '/publish',
        'PATCH',
        {}
      ),
    listAdoptions: () =>
      request<StandardPackageAdoption[]>('/standard-packages/adoptions'),
    adopt: (packageId: string) =>
      request<StandardPackageAdoption>(
        '/standard-packages/' + encodeURIComponent(packageId) + '/adopt',
        'POST',
        {},
        'ALREADY_ADOPTED'
      )
  };
}
