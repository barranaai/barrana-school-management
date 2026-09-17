import { Roadmap } from './roadmapService';
import { PlannedSession, PlannedObjective } from './plannedSessionService';

const base = process.env.REACT_APP_API_URL || '/api';
export const deliveredSessionFailure = 'Unable to confirm this operation. Reload and review the occurrences before retrying.';
export type DeliveryStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export interface ClassOption { _id: string; name: string; schoolId: string; }
export interface DeliveredSession {
  _id: string; schoolId: string; programId: string; levelId: string; roadmapId: string; roadmapVersion: number;
  plannedSessionId: string; classId: string; deliveredBy: string; title: string; scheduledAt: string; deliveredAt?: string;
  status: DeliveryStatus; deliveryNotes?: string; methodologyAdjustments?: string;
  plannedSessionSnapshot: { title: string; description?: string; methodology: string; expectedOutcomes: string[];
    objectives: (PlannedObjective & { objectiveId?: string; requirementLabel?: string; parameterLabel?: string })[] };
}
export interface DeliveryInput { scheduledAt: string; deliveryNotes: string; methodologyAdjustments: string; }
export const nextDeliveryStatuses: Record<DeliveryStatus, DeliveryStatus[]> = {
  scheduled: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: []
};
export function deliveredSessionService(token: string, context: Roadmap, plannedId: string) {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    if (!token || !context.schoolId || !context._id || !context.programId || !context.levelId || !plannedId) throw new Error(deliveredSessionFailure);
    try {
      const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(context.schoolId), {
        method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ ...body, schoolId: context.schoolId }) } : {})
      });
      if (!response.ok) throw new Error();
      const json = await response.json(); if (!json.success) throw new Error(); return json.data;
    } catch (_) { throw new Error(deliveredSessionFailure); }
  }
  function check(row: DeliveredSession) {
    if (row.schoolId !== context.schoolId || row.programId !== context.programId || row.levelId !== context.levelId || row.roadmapId !== context._id || row.roadmapVersion !== context.version || row.plannedSessionId !== plannedId) throw new Error(deliveredSessionFailure);
  }
  function fields(input: DeliveryInput) {
    if (!input.scheduledAt || !Number.isFinite(Date.parse(input.scheduledAt)) || input.deliveryNotes.length > 10000 || input.methodologyAdjustments.length > 10000) throw new Error(deliveredSessionFailure);
    return { scheduledAt: input.scheduledAt, deliveryNotes: input.deliveryNotes, methodologyAdjustments: input.methodologyAdjustments };
  }
  return {
    async load() {
      const planned = await request<PlannedSession>('/planned-sessions/' + encodeURIComponent(plannedId));
      if (planned._id !== plannedId || planned.schoolId !== context.schoolId || planned.roadmapId !== context._id || planned.roadmapVersion !== context.version) throw new Error(deliveredSessionFailure);
      const [rows, classes] = await Promise.all([
        request<DeliveredSession[]>('/delivered-sessions?plannedSessionId=' + encodeURIComponent(plannedId)),
        request<ClassOption[]>('/classes/options')
      ]);
      rows.forEach(check);
      if (!classes.every(c => c.schoolId === context.schoolId)) throw new Error(deliveredSessionFailure);
      return { planned, rows, classes };
    },
    create(classId: string, input: DeliveryInput) {
      if (!classId) throw new Error(deliveredSessionFailure);
      return request<DeliveredSession>('/delivered-sessions', 'POST', { plannedSessionId: plannedId, classId, ...fields(input) });
    },
    edit(row: DeliveredSession, input: DeliveryInput) {
      check(row); if (!nextDeliveryStatuses[row.status]?.length) throw new Error(deliveredSessionFailure);
      return request<DeliveredSession>('/delivered-sessions/' + encodeURIComponent(row._id), 'PUT', fields(input));
    },
    transition(row: DeliveredSession, status: DeliveryStatus) {
      check(row); if (!nextDeliveryStatuses[row.status]?.includes(status)) throw new Error(deliveredSessionFailure);
      return request<DeliveredSession>('/delivered-sessions/' + encodeURIComponent(row._id) + '/status', 'PATCH', { status });
    }
  };
}
