export type QueueBand = 'needs-you' | 'running' | 'ready';

export const QUEUE_BANDS: ReadonlyArray<QueueBand> = ['needs-you', 'running', 'ready'];

export type QueueCommand =
  | Readonly<{ kind: 'next-band' }>
  | Readonly<{ kind: 'step'; delta: 1 | -1 }>
  | Readonly<{ kind: 'primary' }>
  | Readonly<{ kind: 'open' }>
  | Readonly<{ kind: 'not-now' }>
  | Readonly<{ kind: 'peek' }>
  | Readonly<{ kind: 'choice'; index: number }>;

type Params = {
  readonly key: string;
  readonly band: QueueBand;
  readonly isTyping: boolean;
  readonly isOnControl: boolean;
  readonly hasModifier: boolean;
};

const CONTROL_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

const STEP_BY_KEY: Readonly<Record<string, 1 | -1>> = {
  j: 1,
  ArrowDown: 1,
  k: -1,
  ArrowUp: -1,
};

const CHOICE_KEY = /^[1-9]$/;

export const queueKeyOf = ({
  key,
  band,
  isTyping,
  isOnControl,
  hasModifier,
}: Params): QueueCommand | null => {
  if (key === 'F6' && !hasModifier) {
    return { kind: 'next-band' };
  }
  if (isTyping || hasModifier || (isOnControl && CONTROL_KEYS.has(key))) {
    return null;
  }
  const delta = STEP_BY_KEY[key];
  if (delta !== undefined) {
    return { kind: 'step', delta };
  }
  if (key === 'ArrowRight') {
    return { kind: 'open' };
  }
  if (band === 'needs-you') {
    if (key === 'Enter') {
      return { kind: 'primary' };
    }
    if (key === 's' || key === 'S') {
      return { kind: 'not-now' };
    }
    if (CHOICE_KEY.test(key)) {
      return { kind: 'choice', index: Number(key) - 1 };
    }
    return null;
  }
  if (band === 'running' && key === ' ') {
    return { kind: 'peek' };
  }
  return null;
};
