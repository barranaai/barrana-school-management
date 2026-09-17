const base = process.env.REACT_APP_API_URL || '/api';
export type ParameterType = 'text' | 'rating' | 'percentage' | 'number' | 'checkbox' | 'select';
export interface ConfigurationItem { _id: string; schoolId: string; programId: string; levelId?: string; requirementId?: string; name: string; description?: string; sequence: number; isActive: boolean; isRequired: boolean; type?: ParameterType; options?: string[]; }
export interface ConfigurationInput { name: string; description?: string; sequence: number; isRequired: boolean; type?: ParameterType; options?: string[]; }

export function requirementParameterService(token: string, schoolId: string, programId: string, kind: 'requirements' | 'parameters', parentId: string) {
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result.success) throw new Error();
      return result.data;
    } catch (_) { throw new Error('Unable to complete the request. Check your access and connection, then refresh before retrying.'); }
  }
  function scoped(id?: string) {
    if (!schoolId || !programId || !parentId) throw new Error('Choose a school first.');
    return '/config/' + kind + (id ? '/' + encodeURIComponent(id) : '') + '?schoolId=' + encodeURIComponent(schoolId) + '&programId=' + encodeURIComponent(programId) + '&' + (kind === 'requirements' ? 'levelId' : 'requirementId') + '=' + encodeURIComponent(parentId);
  }
  return {
    list: () => request<ConfigurationItem[]>(scoped()),
    save: (id: string | undefined, data: ConfigurationInput) => request<ConfigurationItem>(scoped(id), id ? 'PUT' : 'POST', { name: data.name.trim(), sequence: data.sequence, isRequired: data.isRequired, schoolId, programId, ...(kind === 'requirements' ? { levelId: parentId, description: data.description?.trim() || '' } : { requirementId: parentId, type: data.type, options: data.type === 'select' ? data.options : [] }) }),
    deactivate: (id: string) => request<ConfigurationItem>(scoped(id), 'DELETE')
  };
}
