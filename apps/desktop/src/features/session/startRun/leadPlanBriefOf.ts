import type { RunRouteCloseness, Workflow } from '@goodboy/types';
import { presetSnapshotOf } from './presetSnapshotOf';

type Params = {
  readonly work: string;
  readonly preset: Workflow;
  readonly closeness: RunRouteCloseness;
};

const CLOSENESS_LINE = {
  follow: 'Keep these steps in their order. Ask before you add, skip or move one.',
  adapt: 'You may add, skip or move a step. Say why when you do.',
} as const satisfies Record<RunRouteCloseness, string>;

export const leadPlanBriefOf = ({ work, preset, closeness }: Params): string => {
  const { name, steps } = presetSnapshotOf({ preset });
  const stepLines = steps.map((step, index) => {
    const role = step.role === null ? '' : ` (${step.role})`;
    const brief = step.promptPrefix.trim();
    return `${index + 1}. ${step.name}${role}${brief === '' ? '' : `: ${brief}`}`;
  });
  const process = preset.processText?.trim() ?? '';
  return [
    work,
    `Plan: follow the preset "${name}".`,
    ...(stepLines.length === 0 ? [] : [stepLines.join('\n')]),
    ...(process === '' ? [] : [process]),
    CLOSENESS_LINE[closeness],
  ].join('\n\n');
};
