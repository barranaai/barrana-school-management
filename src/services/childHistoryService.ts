import apiService from './apiService';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export type HistoryName = { id: string; name: string | null } | null;

export interface ChildHistoryEvent {
  type: 'enrollment' | 'enrollment_status' | 'level' | 'group' | 'session' | 'progress' | 'report';
  date: string | null;
  title: string;
  description: string;
  details: Record<string, any>;
}

export interface ChildHistoryData {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    participantId: string | null;
    legacyGrade: string | null;
    isActive: boolean;
  };
  currentEnrollments: Array<{
    enrollmentId: string;
    program: HistoryName;
    level: HistoryName;
    group: HistoryName;
    status: string;
    startDate: string | null;
  }>;
  events: ChildHistoryEvent[];
}

export async function getChildHistory(childId: string, schoolId?: string): Promise<ChildHistoryData> {
  const token = apiService.getToken();
  const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
  const response = await fetch(`${API_BASE_URL}/child-history/${encodeURIComponent(childId)}${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error('You are not authorized to view this participant history.');
    }
    throw new Error('Participant history could not be loaded. Please try again.');
  }
  const payload = await response.json();
  if (!payload?.success || !payload?.data) {
    throw new Error('Participant history could not be loaded. Please try again.');
  }
  return payload.data as ChildHistoryData;
}
