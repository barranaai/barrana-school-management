const base = process.env.REACT_APP_API_URL || '/api';
export interface Level { _id: string; schoolId: string; programId: string; name: string; description?: string; sequence: number; isActive: boolean; }
export interface LevelInput { name: string; description: string; sequence: number; }

export function levelService(token: string, schoolId: string, programId: string) {
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
    if (!schoolId || !programId) throw new Error('Choose a school first.');
    return '/config/levels' + (id ? '/' + encodeURIComponent(id) : '') + '?schoolId=' + encodeURIComponent(schoolId) + '&programId=' + encodeURIComponent(programId);
  }
  return {
    list: () => request<Level[]>(scoped()),
    save: (id: string | undefined, data: LevelInput) => request<Level>(scoped(id), id ? 'PUT' : 'POST', { name: data.name.trim(), description: data.description.trim(), sequence: data.sequence, schoolId, programId }),
    deactivate: (id: string) => request<Level>(scoped(id), 'DELETE')
  };
}
