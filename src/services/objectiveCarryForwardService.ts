const base = process.env.REACT_APP_API_URL || '/api';
export interface CarryForwardTarget { _id: string; title: string; sequence: number; }
export interface CarryForwardSuggestion {
  objectiveId: string;
  status: 'not_achieved' | 'partially_achieved';
  title: string;
  description?: string;
  expectedOutcome?: string;
  source: { progressId: string; deliveredSessionId: string; plannedSessionId: string };
  targets: CarryForwardTarget[];
}
export const carryForwardFailure = 'Unable to confirm the carry-forward operation. Reload Progress before retrying.';
export function objectiveCarryForwardService(token: string, schoolId: string) {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    try {
      const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(schoolId), {
        method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ ...body, schoolId }) } : {})
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error();
      return result.data;
    } catch (_) { throw new Error(carryForwardFailure); }
  }
  return {
    suggestions: (progressId: string) => request<CarryForwardSuggestion[]>('/objective-carry-forward/' + encodeURIComponent(progressId)),
    accept: (progressId: string, objectiveId: string, targetPlannedSessionId: string, objective: Pick<CarryForwardSuggestion, 'title' | 'description' | 'expectedOutcome'> & { instructionalGuidance?: string }) => request<{ targetPlannedSessionId: string; objectiveId: string }>('/objective-carry-forward/' + encodeURIComponent(progressId) + '/accept', 'POST', { objectiveId, targetPlannedSessionId, objective })
  };
}
