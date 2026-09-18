const base = process.env.REACT_APP_API_URL || '/api';
const safeFailure = 'Unable to complete the request. Check your access and connection, then refresh before retrying.';
const safeValidationMessages = new Set([
  'Enrollment cannot be assigned to a class in its current status',
  'A valid class is required',
  'Class not found or unavailable in this school',
  'Effective date must be a valid date',
  'Effective date cannot be before the enrollment start date',
  'Effective date must be after the current class assignment start date',
  'Class is already the current assignment',
  'Enrollment class assignment history is inconsistent'
]);

export type EnrollmentStatus = 'pending' | 'active' | 'paused' | 'completed' | 'withdrawn' | 'cancelled';
export interface EnrollmentHistory { _id?: string; levelId: string; effectiveFrom: string; effectiveTo?: string; reason?: string; }
export interface EnrollmentStatusHistory { _id?: string; status: EnrollmentStatus; changedAt: string; reason?: string; }
export interface EnrollmentClassAssignment { _id?: string; classId: string; effectiveFrom: string; effectiveTo?: string; status: 'active' | 'ended'; reason?: string; }
export interface Enrollment {
  _id: string; schoolId: string; childId: string; programId: string;
  currentLevelId?: string | null; currentClassId?: string | null;
  status: EnrollmentStatus; startDate: string; endDate?: string;
  levelHistory: EnrollmentHistory[]; statusHistory: EnrollmentStatusHistory[];
  classAssignments: EnrollmentClassAssignment[];
}
export interface EnrollmentChild { _id: string; schoolId: string; firstName: string; lastName: string; }
export interface EnrollmentProgram { _id: string; schoolId: string; name: string; isActive: boolean; }
export interface EnrollmentLevel { _id: string; schoolId: string; programId: string; name: string; isActive: boolean; sequence: number; }
export interface EnrollmentClass { _id: string; schoolId: string; name: string; }
export interface EnrollmentSchool { _id: string; name: string; }

const id = (value: unknown) => typeof value === 'string' ? value : String((value as any)?._id || '');

export function enrollmentService(token: string, schoolId: string) {
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    try {
      const response = await fetch(base + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(safeValidationMessages.has(result?.message) ? result.message : safeFailure);
      }
      return result.data;
    } catch (error) {
      if (error instanceof Error && (error.message === safeFailure || safeValidationMessages.has(error.message))) throw error;
      throw new Error(safeFailure);
    }
  }
  function scope(path: string, extra = '') {
    if (!schoolId) throw new Error('Choose an organization first.');
    return path + (path.includes('?') ? '&' : '?') + 'schoolId=' + encodeURIComponent(schoolId) + extra;
  }
  return {
    schools: () => request<EnrollmentSchool[]>('/schools'),
    children: async () => (await request<EnrollmentChild[]>('/students')).filter(child => id(child.schoolId) === schoolId),
    programs: () => request<EnrollmentProgram[]>(scope('/config/programs')),
    levels: (programId: string) => request<EnrollmentLevel[]>(scope('/config/levels', '&programId=' + encodeURIComponent(programId))),
    classes: () => request<EnrollmentClass[]>(scope('/classes/options')),
    list: (childId: string) => request<Enrollment[]>(scope('/enrollments', '&childId=' + encodeURIComponent(childId))),
    create: (data: { childId: string; programId: string; currentLevelId?: string; startDate: string; status: 'pending' | 'active' }) =>
      request<Enrollment>('/enrollments', 'POST', { ...data, schoolId }),
    changeLevel: (enrollmentId: string, currentLevelId: string, effectiveDate: string, reason: string) =>
      request<Enrollment>(scope('/enrollments/' + encodeURIComponent(enrollmentId)), 'PUT', { schoolId, currentLevelId, effectiveDate, reason: reason.trim() }),
    changeClass: (enrollmentId: string, classId: string, effectiveDate: string, reason: string) =>
      request<Enrollment>(scope('/enrollments/' + encodeURIComponent(enrollmentId) + '/class-assignment'), 'PUT', { schoolId, classId, effectiveDate, reason: reason.trim() }),
    changeStatus: (enrollmentId: string, status: 'active' | 'paused', reason: string) =>
      request<Enrollment>(scope('/enrollments/' + encodeURIComponent(enrollmentId)), 'PUT', { schoolId, status, reason: reason.trim() }),
    end: (enrollmentId: string, reason: string) =>
      request<Enrollment>(scope('/enrollments/' + encodeURIComponent(enrollmentId)), 'DELETE', { schoolId, reason: reason.trim() })
  };
}
