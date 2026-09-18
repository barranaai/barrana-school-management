const base = process.env.REACT_APP_API_URL || '/api';

export interface StandardPackage {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  version: number;
  status: 'published';
  organizationTypes: string[];
}

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
  | 'NOT_AUTHORIZED'
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
    body?: unknown
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
        if (response.status === 409) {
          throw new StandardPackageServiceError('ALREADY_ADOPTED');
        }
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
    listAdoptions: () =>
      request<StandardPackageAdoption[]>('/standard-packages/adoptions'),
    adopt: (packageId: string) =>
      request<StandardPackageAdoption>(
        '/standard-packages/' + encodeURIComponent(packageId) + '/adopt',
        'POST',
        {}
      )
  };
}
