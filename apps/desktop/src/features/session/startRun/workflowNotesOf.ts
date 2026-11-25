import type { Workflow } from '@goodboy/types';
import { presetSnapshotOf } from './presetSnapshotOf';

type Params = {
  readonly work: string;
  readonly preset: Workflow;
};

export const workflowNotesOf = ({ work, preset }: Params): string => {
  const { steps } = presetSnapshotOf({ preset });
  const stepLines = steps.flatMap((step, index) => {
    const brief = step.promptPrefix.trim();
    return brief === '' ? [] : [`${index + 1}. ${step.name}: ${brief}`];
  });
  const process = preset.processText?.trim() ?? '';
  return [
    work,
    ...(stepLines.length === 0 ? [] : [stepLines.join('\n')]),
    ...(process === '' ? [] : [process]),
  ].join('\n\n');
};
