import { requestReportPublication } from './reportPublicationService';
const base = process.env.REACT_APP_API_URL || '/api';
export const identity = (value: any): string => typeof value === 'string' ? value : value?._id || '';
export interface Objective { objectiveId: string; title: string; description?: string; expectedOutcome?: string; }
export interface Session { _id: string; title: string; schoolId: string; classId: string; programId: string; levelId: string; plannedSessionId: string; roadmapId: string; roadmapVersion: number; status: string; scheduledAt?: string; deliveredAt?: string; plannedSessionSnapshot: { title: string; objectives: Objective[] }; }
export interface Participation { _id: string; childId: string; schoolId: string; deliveredSessionId: string; status: string; }
export interface Parameter { _id: string; name: string; type: string; programId?: string; requirementId?: string; options?: string[]; }
export interface Progress { _id: string; childParticipationId: string; objectiveResults: { objectiveId: string; status: string; instructorNote?: string; evidence?: string }[]; parameterResults: { parameterId: string; value: string | number | boolean; note?: string }[]; observations?: string; recommendations?: string; overallStatus?: string; }
export interface WorkflowReport { _id: string; progressId: string; status: string; title: string; content: string; customFieldValues: Record<string, any>; templateSnapshot?: { customFields?: { name: string; type: string; isRequired?: boolean }[] }; finalizedSnapshot?: { parentVisibleContent: string; customFieldValues?: Record<string, any>; reportMetadata: { title: string } }; }
export class WorkflowError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
export const conflictMessage = 'This report was changed by another action. Refresh and review the latest version.';
export function workflowError(error: unknown): string {
  if (error instanceof WorkflowError && error.code === 'REPORT_REVISION_CONFLICT') return conflictMessage;
  if (error instanceof WorkflowError && [401, 403].includes(error.status)) return 'You are not authorized for this action. Sign in again or contact your school administrator.';
  return error instanceof Error ? error.message : 'Request failed. Please try again.';
}
export function workflowService(token: string, schoolId: string) {
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  async function response(path: string, method = 'GET', body?: unknown) {
    let r: Response;
    try { r = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(schoolId), { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch (_) { throw new WorkflowError('Network failure. Your work has not been cleared. Check the latest state before retrying.', 0); }
    const data = await r.json();
    if (!r.ok || !data.success) throw new WorkflowError(data.message || data.error || 'Request failed', r.status, data.code);
    return data;
  }
  async function request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> { return (await response(path, method, body)).data; }
  return {
    request,
    sessions: () => request<Session[]>('/delivered-sessions'),
    async session(id: string) {
      const s = await request<Session>('/delivered-sessions/' + id);
      const [participations, program, level, planned, requirements, templates] = await Promise.all([
        request<Participation[]>('/child-participations?deliveredSessionId=' + id), request('/config/programs/' + s.programId), request('/config/levels/' + s.levelId), request('/planned-sessions/' + s.plannedSessionId), request<any[]>('/config/requirements?levelId=' + s.levelId), request<any[]>('/report-templates')
      ]);
      // Legacy snapshots remain readable via the API; never infer identity from title/sequence.
      if ((s.plannedSessionSnapshot?.objectives || []).some(o => !o.objectiveId)) throw new WorkflowError('This legacy session snapshot has no objective IDs. Progress entry is unavailable; contact your administrator.', 409);
      if (identity(planned.roadmapId) !== s.roadmapId || planned.roadmapVersion !== s.roadmapVersion || JSON.stringify((planned.objectives || []).map((o: { _id: string }) => o._id)) !== JSON.stringify((s.plannedSessionSnapshot?.objectives || []).map(o => o.objectiveId))) throw new WorkflowError('The planned session no longer matches the delivered snapshot. Contact your administrator.', 409);
      const children = participations.filter(p => identity(p.deliveredSessionId) === id && identity(p.schoolId) === schoolId);
      const users = await Promise.all(children.map(p => request('/users/' + identity(p.childId))));
      if (users.some(u => identity(u.schoolId) !== schoolId)) throw new WorkflowError('Child/session school mismatch. Contact your administrator.', 409);
      const parameters = (await Promise.all(requirements.filter(r => identity(r.programId) === s.programId).map(r => request<Parameter[]>('/config/parameters?requirementId=' + r._id)))).flat().filter(p => identity(p.programId) === s.programId);
      return { session: s, children, users, program, level, parameters, templates: templates.filter(t => t.isActive && identity(t.schoolId) === schoolId) };
    },
    progress: (participation: string) => request<Progress[]>('/progress?childParticipationId=' + participation),
    saveProgress: (id: string | undefined, body: Record<string, unknown>) => request<Progress>('/progress' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', id ? body : { ...body, schoolId }),
    async findReport(child: string, progress: string): Promise<WorkflowReport | undefined> {
      let page = 1;
      while (true) {
        const r = await response('/reports?studentId=' + child + '&page=' + page);
        const report = r.data.find((item: WorkflowReport) => identity(item.progressId) === progress);
        if (report) return report;
        if (page >= r.pages || !r.data.length) return undefined;
        page++;
      }
    },
    draft: (id: string, templateId: string) => request<WorkflowReport>('/reports/from-progress/' + id, 'POST', { schoolId, templateId }),
    edit: (id: string, body: unknown) => request<WorkflowReport>('/reports/' + id, 'PUT', body),
    approve: (id: string) => request<WorkflowReport>('/reports/' + id + '/approve', 'PATCH', {}),
    send: (id: string, parentEmail: string) => requestReportPublication(base + '/reports/' + id + '/send-email', headers, { parentEmail })
  };
}
export type WorkflowService = ReturnType<typeof workflowService>;
