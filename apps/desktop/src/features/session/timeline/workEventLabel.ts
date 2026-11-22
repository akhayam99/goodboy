import type { WorkEvent } from '@goodboy/db';
import { workOutcomeOf } from '../../scripts/workOutcomeOf';
import type { TimelineWorkEntry } from './timelineFactEntries';
import type { TimelineLabelSegment } from './sessionEventPresentation';

type Params = {
  readonly entry: TimelineWorkEntry;
};

type WorkParams = {
  readonly work: WorkEvent;
};

type PayloadTextParams = {
  readonly work: WorkEvent;
  readonly key: string;
};

const payloadTextOf = ({ work, key }: PayloadTextParams): string | null => {
  const value = work.payload[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const subjectOf = ({ work }: WorkParams): string => {
  switch (work.kind) {
    case 'script':
      return (
        payloadTextOf({ work, key: 'name' }) ??
        payloadTextOf({ work, key: 'scriptId' }) ??
        'A script'
      );
    case 'command':
      return payloadTextOf({ work, key: 'command' }) ?? 'A command';
    case 'check-rerun':
      return payloadTextOf({ work, key: 'name' }) ?? 'A check';
    default: {
      const exhaustive: never = work.kind;
      return exhaustive;
    }
  }
};

const outcomeWordOf = ({ work }: WorkParams): string => {
  const verb = work.kind === 'check-rerun' ? 'rerun ' : '';
  const outcome = workOutcomeOf({ endedAt: work.endedAt, exitCode: work.exitCode });
  switch (outcome) {
    case 'unfinished':
      return `${verb}started`;
    case 'cancelled':
      return `${verb}stopped`;
    case 'ok':
      return `${verb}passed`;
    case 'error':
      return `${verb}failed (exit ${work.exitCode ?? ''})`;
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};

export const workEventLabel = ({ entry }: Params): ReadonlyArray<TimelineLabelSegment> => {
  const { work, mountName } = entry;
  const said: ReadonlyArray<TimelineLabelSegment> = [
    { kind: 'value', text: subjectOf({ work }), variant: 'path' },
    { kind: 'text', text: ` ${outcomeWordOf({ work })}` },
  ];
  if (mountName === null) {
    return said;
  }
  return [
    ...said,
    { kind: 'text', text: ' in ' },
    { kind: 'value', text: mountName, variant: 'project' },
  ];
};
