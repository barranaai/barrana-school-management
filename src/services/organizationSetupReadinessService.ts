import { levelService, Level } from './levelService';
import { plannedSessionService, PlannedSession } from './plannedSessionService';
import { programService, Program } from './programService';
import { requirementParameterService, ConfigurationItem } from './requirementParameterService';
import { roadmapService, Roadmap } from './roadmapService';

export interface LevelSetupSnapshot {
  level: Level;
  requirements: ConfigurationItem[];
  parameters: ConfigurationItem[];
  roadmaps: Roadmap[];
  sessions: PlannedSession[];
}

export interface ProgramSetupSnapshot {
  program: Program;
  levels: LevelSetupSnapshot[];
}

export interface OrganizationSetupSnapshot {
  programs: ProgramSetupSnapshot[];
}

export type SetupStepStatus = 'complete' | 'needs_attention';

export interface OrganizationSetupStep {
  key: 'programs' | 'levels' | 'assessment' | 'plans' | 'activation';
  title: string;
  description: string;
  status: SetupStepStatus;
}

export interface OrganizationSetupReadiness {
  ready: boolean;
  steps: OrganizationSetupStep[];
}

const active = <T extends { isActive?: boolean }>(rows: T[]) => rows.filter(row => row.isActive !== false);

export function evaluateOrganizationSetup(snapshot: OrganizationSetupSnapshot): OrganizationSetupReadiness {
  const programs = snapshot.programs.filter(row => row.program.isActive !== false);
  const levels = programs.flatMap(row => active(row.levels.map(item => item.level)).map(level =>
    row.levels.find(item => item.level._id === level._id)!
  ));
  const hasPrograms = programs.length > 0;
  const hasLevels = hasPrograms && programs.every(row => active(row.levels.map(item => item.level)).length > 0);
  const hasAssessment = hasLevels && levels.every(row => active(row.requirements).length > 0 && active(row.parameters).length > 0);
  const hasPlans = hasLevels && levels.every(row =>
    row.roadmaps.some(roadmap => roadmap.status !== 'archived') &&
    row.sessions.some(session => session.status !== 'archived')
  );
  const isActivated = hasPlans && levels.every(row => {
    const activeRoadmapIds = new Set(row.roadmaps.filter(roadmap => roadmap.status === 'active').map(roadmap => roadmap._id));
    return activeRoadmapIds.size > 0 && row.sessions.some(session => session.status === 'active' && activeRoadmapIds.has(session.roadmapId));
  });

  const step = (key: OrganizationSetupStep['key'], title: string, complete: boolean, description: string): OrganizationSetupStep => ({
    key, title, description, status: complete ? 'complete' : 'needs_attention'
  });

  const steps = [
    step('programs', 'Choose what you offer', hasPrograms, hasPrograms ? `${programs.length} active Program${programs.length === 1 ? '' : 's'} configured.` : 'Add a Program or adopt a suitable Standard Package.'),
    step('levels', 'Define the progression', hasLevels, hasLevels ? `${levels.length} active Level${levels.length === 1 ? '' : 's'} configured.` : 'Add at least one Level to every active Program.'),
    step('assessment', 'Define how progress is observed', hasAssessment, hasAssessment ? 'Every active Level has Requirements and Parameters.' : 'Add Requirements and Parameters to every active Level.'),
    step('plans', 'Prepare the teaching plan', hasPlans, hasPlans ? 'Every active Level has a Roadmap and Planned Session.' : 'Add a Roadmap and Planned Session to every active Level.'),
    step('activation', 'Make the plan ready to deliver', isActivated, isActivated ? 'Active Roadmaps and Planned Sessions are ready for delivery.' : 'Review and activate the Roadmap and Planned Sessions you are ready to use.')
  ];

  return { ready: steps.every(item => item.status === 'complete'), steps };
}

export function organizationSetupReadinessService(token: string, schoolId: string) {
  return {
    async load(): Promise<OrganizationSetupReadiness> {
      if (!token || !schoolId) throw new Error('Organization context is unavailable.');
      try {
        const programs = active(await programService(token, schoolId).list());
        const snapshots = await Promise.all(programs.map(async program => {
          const levels = active(await levelService(token, schoolId, program._id).list());
          const levelSnapshots = await Promise.all(levels.map(async level => {
            const requirements = active(await requirementParameterService(token, schoolId, program._id, 'requirements', level._id).list());
            const parameters = active((await Promise.all(requirements.map(requirement =>
              requirementParameterService(token, schoolId, program._id, 'parameters', requirement._id).list()
            ))).flat());
            const roadmaps = (await roadmapService(token, schoolId, program._id, level._id).list()).filter(roadmap => roadmap.status !== 'archived');
            const sessions = (await Promise.all(roadmaps.map(async roadmap =>
              (await plannedSessionService(token, roadmap).load()).sessions
            ))).flat();
            return { level, requirements, parameters, roadmaps, sessions };
          }));
          return { program, levels: levelSnapshots };
        }));
        return evaluateOrganizationSetup({ programs: snapshots });
      } catch (_) {
        throw new Error('Unable to check setup readiness. Check your access and connection, then retry.');
      }
    }
  };
}
