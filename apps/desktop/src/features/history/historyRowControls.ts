import type { MountId, SessionEvent } from '@goodboy/types';

export type HistoryRowVerb =
  | 'undo'
  | 'retry'
  | 'retry-with-note'
  | 'rewrite-with-agent'
  | 'change-plan'
  | 'restore-previous'
  | 'discard-plan';

export type HistoryRowControls = {
  readonly primary: HistoryRowVerb | null;
  readonly secondary: ReadonlyArray<HistoryRowVerb>;
};

export const HISTORY_ROW_LABEL: Readonly<Record<HistoryRowVerb, string>> = {
  undo: 'Undo rewrite',
  retry: 'Retry',
  'retry-with-note': 'Retry with a note',
  'rewrite-with-agent': 'Rewrite with an agent',
  'change-plan': 'Change the plan',
  'restore-previous': 'Restore previous history',
  'discard-plan': 'Discard plan',
};

const isHistoryEvent = ({ event }: { readonly event: SessionEvent }): boolean =>
  event.kind.startsWith('history_');

type Params = {
  readonly event: SessionEvent;
  readonly events: ReadonlyArray<SessionEvent>;
};

const isSuperseded = ({ event, events }: Params): boolean => {
  const mountId = event.payload?.mountId ?? null;
  return events.some(
    (other) =>
      other.id !== event.id &&
      isHistoryEvent({ event: other }) &&
      (other.payload?.mountId ?? null) === mountId &&
      other.createdAt > event.createdAt,
  );
};

export const historyMountOf = ({ event }: { readonly event: SessionEvent }): MountId | null =>
  (event.payload?.mountId ?? null) as MountId | null;

export const historyRowControls = ({ event, events }: Params): HistoryRowControls | null => {
  if (!isHistoryEvent({ event }) || isSuperseded({ event, events })) {
    return null;
  }
  const isRebase = event.payload?.origin === 'rebase';
  if (event.kind === 'history_rewritten') {
    return event.payload?.backupRef == null ? null : { primary: 'undo', secondary: [] };
  }
  if (event.kind === 'history_pushed') {
    return { primary: null, secondary: ['restore-previous'] };
  }
  if (event.kind !== 'history_stopped') {
    return null;
  }
  const reason = event.payload?.reason ?? 'failed';
  if (reason === 'stuck') {
    return {
      primary: 'retry-with-note',
      secondary: isRebase ? [] : ['change-plan', 'discard-plan'],
    };
  }
  if (isRebase) {
    return { primary: 'retry', secondary: [] };
  }
  return {
    primary: 'retry',
    secondary:
      reason === 'conflict' || reason === 'hook'
        ? ['rewrite-with-agent', 'change-plan', 'discard-plan']
        : ['change-plan', 'discard-plan'],
  };
};
