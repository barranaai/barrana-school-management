import { Roadmap } from './roadmapService';
import { ConfigurationItem } from './requirementParameterService';
const base = process.env.REACT_APP_API_URL || '/api';
export const plannedSessionFailure = 'Unable to confirm this operation. Reload and review the session before retrying.';
export interface PlannedObjective { _id?: string; sequence: number; title: string; description?: string; expectedOutcome?: string; instructionalGuidance?: string; requirementId?: string | null; parameterId?: string | null; metadata?: unknown; }
export interface PlannedSession { _id: string; schoolId: string; roadmapId: string; roadmapVersion: number; sequence: number; title: string; description?: string; expectedOutcomes: string[]; methodology?: string; status: 'draft' | 'active' | 'archived'; objectives: PlannedObjective[]; }
export interface SessionInput { title: string; description: string; sequence: number; expectedOutcomes: string[]; methodology: string; objectives: PlannedObjective[]; }
export function plannedSessionService(token: string, context: Roadmap) {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    if (!context.schoolId || !context._id || !context.programId || !context.levelId) throw new Error(plannedSessionFailure);
    try {
      const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(context.schoolId), { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify({ ...body, schoolId: context.schoolId }) } : {}) });
      if (!response.ok) throw new Error();
      const json = await response.json(); if (!json.success) throw new Error(); return json.data;
    } catch (_) { throw new Error(plannedSessionFailure); }
  }
  function check(row: PlannedSession) { if (row.schoolId !== context.schoolId || row.roadmapId !== context._id || row.roadmapVersion !== context.version) throw new Error(plannedSessionFailure); }
  return {
    async load() {
      const roadmap = await request<Roadmap>('/roadmaps/' + encodeURIComponent(context._id));
      if (roadmap._id !== context._id || roadmap.schoolId !== context.schoolId || roadmap.programId !== context.programId || roadmap.levelId !== context.levelId || roadmap.version !== context.version) throw new Error(plannedSessionFailure);
      if (roadmap.status === 'archived') return { roadmap, sessions: [], requirements: [], parameters: [] };
      const [sessions, requirements] = await Promise.all([
        request<PlannedSession[]>('/roadmaps/' + encodeURIComponent(context._id) + '/sessions'),
        request<ConfigurationItem[]>('/config/requirements?levelId=' + encodeURIComponent(context.levelId))
      ]);
      sessions.forEach(check);
      if (!requirements.every(r => r.schoolId === context.schoolId && r.programId === context.programId && r.levelId === context.levelId && r.isActive)) throw new Error(plannedSessionFailure);
      const parameters = (await Promise.all(requirements.map(async r => {
        const values = await request<ConfigurationItem[]>('/config/parameters?requirementId=' + encodeURIComponent(r._id));
        if (!values.every(p => p.schoolId === context.schoolId && p.programId === context.programId && p.requirementId === r._id && p.isActive)) throw new Error(plannedSessionFailure);
        return values;
      }))).flat();
      return { roadmap, sessions: sessions.sort((a, b) => a.sequence - b.sequence), requirements, parameters };
    },
    save(row: PlannedSession | undefined, input: SessionInput) {
      if (row) { check(row); if (row.status !== 'draft') throw new Error(plannedSessionFailure); }
      const { sequence, ...fields } = input;
      return request<PlannedSession>(row ? '/planned-sessions/' + encodeURIComponent(row._id) : '/roadmaps/' + encodeURIComponent(context._id) + '/sessions', row ? 'PUT' : 'POST', { ...fields, ...(row ? {} : { sequence }) });
    },
    activate(row: PlannedSession) { check(row); if (row.status !== 'draft') throw new Error(plannedSessionFailure); return request<PlannedSession>('/planned-sessions/' + encodeURIComponent(row._id) + '/activate', 'PATCH', {}); },
    archive(row: PlannedSession) { check(row); return request<PlannedSession>('/planned-sessions/' + encodeURIComponent(row._id), 'DELETE'); }
  };
}
