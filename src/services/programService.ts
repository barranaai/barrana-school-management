const base = process.env.REACT_APP_API_URL || '/api';
export interface Program { _id: string; schoolId: string; name: string; description?: string; displayOrder: number; isActive: boolean; }
export interface ProgramInput { name: string; description: string; displayOrder: number; }
export interface ProgramSchool { _id: string; name: string; }
export function programService(token: string, schoolId: string) {
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
    if (!schoolId) throw new Error('Choose a school first.');
    return '/config/programs' + (id ? '/' + encodeURIComponent(id) : '') + '?schoolId=' + encodeURIComponent(schoolId);
  }
  return {
    schools: () => request<ProgramSchool[]>('/schools'),
    list: () => request<Program[]>(scoped()),
    save: (id: string | undefined, data: ProgramInput) => request<Program>(scoped(id), id ? 'PUT' : 'POST', { name: data.name.trim(), description: data.description.trim(), displayOrder: data.displayOrder, schoolId }),
    deactivate: (id: string) => request<Program>(scoped(id), 'DELETE')
  };
}
