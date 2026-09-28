import type { HistoryPlannedStep, HistoryTrialStop } from '@goodboy/types';

type Params = {
  readonly branch: string;
  readonly base: string;
  readonly copyPath: string;
  readonly order: ReadonlyArray<HistoryPlannedStep>;
  readonly stop: HistoryTrialStop;
  readonly note?: string;
};

const short = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);

const VERB_WORD = {
  pick: 'pick',
  reword: 'reword',
  squash: 'squash into the step above',
  fixup: 'fold into the step above, keep its message',
  drop: 'drop',
} as const;

const stepLine = ({
  step,
  index,
}: {
  readonly step: HistoryPlannedStep;
  readonly index: number;
}): string => {
  const head = `${index + 1}. ${VERB_WORD[step.verb]} ${step.sha}`;
  if (step.verb === 'drop') {
    return head;
  }
  const message = step.message
    .split('\n')
    .map((line) => `   | ${line}`)
    .join('\n');
  return `${head}\n   message:\n${message}`;
};

export const rewriterKickoff = ({ branch, base, copyPath, order, stop, note }: Params): string => {
  const stoppedAt = order.findIndex((step) => step.sha === stop.sha);
  const position = stoppedAt < 0 ? stop.index : stoppedAt;
  const files = stop.files.length > 0 ? stop.files.join(', ') : 'no file listed';
  const lines = [
    `Replay the history plan of ${branch} in the copy at ${copyPath}.`,
    `The copy is a detached checkout of base ${short({ sha: base })}. Every step before step ${position + 1} is already committed there.`,
    '',
    'Plan, oldest first:',
    ...order.map((step, index) => stepLine({ step, index })),
    '',
    stop.kind === 'hook'
      ? `Step ${position + 1} (${short({ sha: stop.sha })}) stopped on a hook: ${stop.message}`
      : `Step ${position + 1} (${short({ sha: stop.sha })}) stopped on a conflict in ${files}. The conflict markers are in the copy now and the step is not committed yet.`,
    `Settle it, commit step ${position + 1} with its message, then replay the remaining steps in order.`,
    'Every planned step stays a commit. When a step brings nothing new because its changes are already there, commit it anyway with git commit --allow-empty and its message; never skip a step.',
  ];
  if (note !== undefined && note.trim() !== '') {
    lines.push('', `A note from the person who asked for this rewrite: ${note.trim()}`);
  }
  return lines.join('\n');
};
