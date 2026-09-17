import { DeliveredSession } from './deliveredSessionService';

const base = process.env.REACT_APP_API_URL || '/api';
export const participationFailure = 'Unable to confirm this participation operation. Reload the session before retrying.';
export type ParticipationStatus = 'active' | 'excused' | 'absent' | 'cancelled';
export interface EligibleParticipant { childId: string; enrollmentId: string; firstName: string; lastName: string; }
export interface SessionParticipation {
  _id: string; schoolId: string; deliveredSessionId: string; childId: string; enrollmentId: string;
  status: ParticipationStatus; firstName?: string; lastName?: string;
}
export interface SessionRoster { eligible: EligibleParticipant[]; participations: SessionParticipation[]; }
export const nextParticipationStatuses: Record<ParticipationStatus, ParticipationStatus[]> = {
  active: ['excused', 'absent', 'cancelled'], excused: ['active'], absent: ['active'], cancelled: []
};

const identity = (value: unknown) => typeof value === 'string' ? value : String((value as any)?._id || '');

export function participationService(token: string, schoolId: string, session: DeliveredSession) {
  function validateSession() {
    if (!token || !schoolId || !session?._id || session.schoolId !== schoolId) throw new Error(participationFailure);
  }
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    validateSession();
    try {
      const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(schoolId), {
        method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ ...body, schoolId }) } : {})
      });
      if (!response.ok) throw new Error();
      const json = await response.json();
      if (!json.success) throw new Error();
      return json.data;
    } catch (_) { throw new Error(participationFailure); }
  }
  function validate(row: SessionParticipation) {
    if (identity(row.schoolId) !== schoolId || identity(row.deliveredSessionId) !== session._id) throw new Error(participationFailure);
  }
  return {
    async load(): Promise<SessionRoster> {
      const roster = await request<SessionRoster>('/child-participations/eligible?deliveredSessionId=' + encodeURIComponent(session._id));
      if (!Array.isArray(roster.eligible) || !Array.isArray(roster.participations)) throw new Error(participationFailure);
      roster.participations.forEach(validate);
      const existingChildren = new Set(roster.participations.map(row => identity(row.childId)));
      if (roster.eligible.some(candidate => !candidate.childId || !candidate.enrollmentId || existingChildren.has(identity(candidate.childId)))) throw new Error(participationFailure);
      return roster;
    },
    add(candidate: EligibleParticipant) {
      if (!candidate.childId || !candidate.enrollmentId) throw new Error(participationFailure);
      return request<SessionParticipation>('/child-participations', 'POST', {
        deliveredSessionId: session._id, childId: candidate.childId, enrollmentId: candidate.enrollmentId
      });
    },
    changeStatus(row: SessionParticipation, status: ParticipationStatus) {
      validate(row);
      if (!nextParticipationStatuses[row.status]?.includes(status)) throw new Error(participationFailure);
      if (status === 'cancelled') return request<SessionParticipation>('/child-participations/' + encodeURIComponent(row._id), 'DELETE');
      return request<SessionParticipation>('/child-participations/' + encodeURIComponent(row._id), 'PUT', { status });
    }
  };
}
