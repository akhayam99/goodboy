import type { WorkEvent } from '@goodboy/db';
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

const workOutcomeOf = ({ work }: WorkParams): string => {
  if (work.endedAt === null) {
    return work.kind === 'check-rerun' ? 'rerun started' : 'started';
  }
  const verb = work.kind === 'check-rerun' ? 'rerun ' : '';
  if (work.exitCode === null) {
    return `${verb}stopped`;
  }
  if (work.exitCode === 0) {
    return `${verb}passed`;
  }
  return `${verb}failed (exit ${work.exitCode})`;
};

export const workEventLabel = ({ entry }: Params): ReadonlyArray<TimelineLabelSegment> => {
  const { work, mountName } = entry;
  const said: ReadonlyArray<TimelineLabelSegment> = [
    { kind: 'value', text: subjectOf({ work }), variant: 'path' },
    { kind: 'text', text: ` ${workOutcomeOf({ work })}` },
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
