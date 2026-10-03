import type { AgentRole, WorkflowRun } from '@goodboy/types';

type SectionParams = {
  readonly run: Pick<WorkflowRun, 'executionMode' | 'rulesSnapshot'> | null | undefined;
  readonly role: AgentRole | null;
};

export const standingGuidanceSection = ({ run, role }: SectionParams): string => {
  const rules = run?.rulesSnapshot;
  const text = rules?.standingGuidance.trim() ?? '';
  if (rules === undefined || text === '' || run?.executionMode === 'dynamic' || role === null) {
    return '';
  }
  return rules.guidanceRoles.includes(role) ? `**Standing guidance**\n${text}` : '';
};

type ProcessParams = {
  readonly processText: string | undefined;
  readonly run: Pick<WorkflowRun, 'rulesSnapshot'>;
};

export const orchestratorProcessText = ({ processText, run }: ProcessParams): string => {
  const process = processText?.trim() ?? '';
  const standing = run.rulesSnapshot?.standingGuidance.trim() ?? '';
  if (standing === '' || process.includes(standing)) {
    return process;
  }
  return process === '' ? standing : `${process}\n\n${standing}`;
};
