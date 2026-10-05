import type { TranscriptItem } from './transcript-items';

type Item = TranscriptItem;
type Transition = Extract<Item, { kind: 'step_transition' }>;

const BETWEEN_TURN_ATTEMPTS: ReadonlySet<Item['kind']> = new Set([
  'auth_required',
  'cli_too_old',
  'error',
  'decision_note',
  'usage',
  'done',
]);

type TransitionParams = {
  readonly items: ReadonlyArray<Item>;
  readonly transition: Transition;
};

const isSameTransition = (previous: Transition, next: Transition): boolean =>
  previous.fromAgentId === next.fromAgentId &&
  previous.fromStep.ordinal === next.fromStep.ordinal &&
  previous.toStep.ordinal === next.toStep.ordinal;

export const isRepeatedStepTransition = ({ items, transition }: TransitionParams): boolean => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item === undefined) {
      continue;
    }
    if (item.kind === 'step_transition') {
      return isSameTransition(item, transition);
    }
    if (!BETWEEN_TURN_ATTEMPTS.has(item.kind)) {
      return false;
    }
  }
  return false;
};

const noticeSignature = (item: Item): string | null => {
  switch (item.kind) {
    case 'auth_required':
      return `auth:${item.providerId}`;
    case 'cli_too_old':
      return `cli:${item.payload.providerId}:${item.payload.modelKey ?? ''}:${item.payload.installedVersion}`;
    case 'error':
      return `error:${item.message}`;
    default:
      return null;
  }
};

type NoticeParams = {
  readonly items: ReadonlyArray<Item>;
  readonly message: string;
};

export const repeatsEarlierFallbackNotice = ({ items, message }: NoticeParams): boolean => {
  const banner = items.at(-1);
  const signature = banner === undefined ? null : noticeSignature(banner);
  if (signature === null) {
    return false;
  }
  for (let index = 0; index < items.length - 1; index += 1) {
    const earlier = items[index];
    const note = items[index + 1];
    if (
      earlier !== undefined &&
      noticeSignature(earlier) === signature &&
      note?.kind === 'decision_note' &&
      note.message === message
    ) {
      return true;
    }
  }
  return false;
};
