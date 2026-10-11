const base = process.env.REACT_APP_API_URL || '/api';

export interface IndividualLessonEnrollment {
  _id: string;
  child: { _id: string; firstName: string; lastName: string };
  program: { _id: string; name: string };
  level: { _id: string; name: string };
  status: 'active';
  startDate: string;
  endDate?: string;
}

export const individualLessonFailure = 'Unable to load your individual lesson assignments. Reload before retrying.';

export async function getIndividualLessonEnrollments(token: string, scheduledAt: string): Promise<IndividualLessonEnrollment[]> {
  if (!token || !scheduledAt || !Number.isFinite(Date.parse(scheduledAt))) throw new Error(individualLessonFailure);
  try {
    const response = await fetch(`${base}/teachers/me/individual-enrollments?scheduledAt=${encodeURIComponent(scheduledAt)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error();
    const json = await response.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error();
    return json.data;
  } catch (_) {
    throw new Error(individualLessonFailure);
  }
}
