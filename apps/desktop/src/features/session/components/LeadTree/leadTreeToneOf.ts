import type { Tone, WorkNodeState } from '@goodboy/ui';

type Params = {
  readonly node: WorkNodeState;
};

const TONES: Readonly<Partial<Record<WorkNodeState, Tone>>> = {
  running: 'info',
  ready: 'warning',
  question: 'warning',
  budget: 'warning',
  approval: 'warning',
  alert: 'warning',
  failed: 'danger',
  approved: 'success',
  done: 'success',
  merging: 'primary',
};

export const leadTreeToneOf = ({ node }: Params): Tone => TONES[node] ?? 'neutral';
