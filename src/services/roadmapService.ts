const base = process.env.REACT_APP_API_URL || '/api';
export interface Roadmap { _id: string; schoolId: string; programId: string; levelId: string; name: string; description?: string; methodology?: string; version: number; __v?: number; status: 'draft' | 'active' | 'archived'; effectiveFrom?: string; effectiveTo?: string; }
export interface RoadmapInput { name: string; description: string; methodology: string; effectiveFrom?: string | null; effectiveTo?: string | null; }
export const roadmapConflict = 'This Roadmap changed. Reload and review the latest version before retrying.';
export const roadmapFailure = 'The operation could not be confirmed. Reload and review before retrying.';
export class RoadmapError extends Error {}
export function roadmapService(token: string, schoolId: string, programId: string, levelId: string) {
  async function request<T>(suffix = '', method = 'GET', body?: object, status?: string): Promise<T> {
    if (!schoolId || !programId || !levelId) throw new RoadmapError(roadmapFailure);
    const query = new URLSearchParams({ schoolId, programId, levelId, ...(status ? { status } : {}) });
    try {
      const response = await fetch(base + '/roadmaps' + suffix + '?' + query, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify({ ...body, schoolId }) } : {}) });
      if (response.status === 409) throw new RoadmapError(roadmapConflict);
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result.success) throw new Error();
      return result.data;
    } catch (error) { throw error instanceof RoadmapError ? error : new RoadmapError(roadmapFailure); }
  }
  function check(row: Roadmap) {
    if (row.schoolId !== schoolId || row.programId !== programId || row.levelId !== levelId || (row.__v !== undefined && (!Number.isSafeInteger(row.__v) || row.__v < 0))) throw new RoadmapError(roadmapFailure);
  }
  function revision(row: Roadmap) { check(row); return row.__v === undefined ? null : row.__v; }
  function fields(input: RoadmapInput, edit = false) {
    return { name: input.name.trim(), description: input.description.trim(), methodology: input.methodology.trim(), ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}), ...(edit && input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}) };
  }
  return {
    async list() {
      const batches = await Promise.all(['draft', 'active', 'archived'].map(status => request<Roadmap[]>('', 'GET', undefined, status)));
      const rows = batches.flat(); rows.forEach(check);
      if (new Set(rows.map(r => r._id)).size !== rows.length || rows.filter(r => r.status === 'active').length > 1) throw new RoadmapError(roadmapFailure);
      return rows.sort((a, b) => b.version - a.version);
    },
    create: (input: RoadmapInput) => request<Roadmap>('', 'POST', { ...fields(input), programId, levelId }),
    edit(row: Roadmap, input: RoadmapInput) { if (row.status !== 'draft') throw new RoadmapError(roadmapConflict); return request<Roadmap>('/' + encodeURIComponent(row._id), 'PUT', { ...fields(input, true), __v: revision(row) }); },
    version(row: Roadmap) { check(row); return request<Roadmap>('/' + encodeURIComponent(row._id) + '/versions', 'POST', {}); },
    activate(row: Roadmap, predecessor: Roadmap | undefined, effectiveFrom: string) {
      if (row.status !== 'draft' || (predecessor && predecessor.status !== 'active')) throw new RoadmapError(roadmapConflict);
      return request<Roadmap>('/' + encodeURIComponent(row._id) + '/activate', 'PATCH', { __v: revision(row), expectedPredecessor: predecessor ? { _id: predecessor._id, __v: revision(predecessor) } : null, effectiveFrom });
    },
    deactivate(row: Roadmap, effectiveTo: string) { if (row.status !== 'active') throw new RoadmapError(roadmapConflict); return request<Roadmap>('/' + encodeURIComponent(row._id) + '/deactivate', 'PATCH', { __v: revision(row), effectiveTo }); }
  };
}
