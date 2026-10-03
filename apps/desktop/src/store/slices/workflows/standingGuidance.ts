import type { AgentRole, WorkflowRun } from '@goodboy/types';

type SectionParams = {
  readonly run: Pick<WorkflowRun, 'executionMode' | 'rulesSnapshot'> | null | undefined;
  readonly role: AgentRole | null;
};

export const guidanceSentTo = ({ run, role }: SectionParams): string | null => {
  const rules = run?.rulesSnapshot;
  const text = rules?.standingGuidance.trim() ?? '';
  if (rules === undefined || text === '' || run?.executionMode === 'dynamic' || role === null) {
    return null;
  }
  return rules.guidanceRoles.includes(role) ? text : null;
};

export const standingGuidanceSection = ({ run, role }: SectionParams): string => {
  const text = guidanceSentTo({ run, role });
  return text === null ? '' : `**Standing guidance**\n${text}`;
};

export const guidanceTagTip = ({ text }: { readonly text: string }): string => {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
    .filter((line) => line !== '');
  const [first = ''] = lines;
  const more = lines.length - 1;
  return `\u201c${first}\u201d${more > 0 ? `, and ${more} more` : ''}`;
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
