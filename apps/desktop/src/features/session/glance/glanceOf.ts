import type { Tone } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
import { AUTO_STATE_TONE } from '../../auto/chat/autoStateTone';

export type GlanceState =
  | 'waiting'
  | 'running'
  | 'queued'
  | 'ready'
  | 'paused'
  | 'failed'
  | 'stopping'
  | 'stopped'
  | 'done'
  | 'idle'
  | 'skipped';

export type Glance = Readonly<{
  state: GlanceState;
  word: string;
  tone: Tone;
  sentence: string;
  isLive: boolean;
}>;

type Params = {
  readonly state: GlanceState;
  readonly sentence: string;
  readonly word?: string;
};

const WORD: Record<GlanceState, string> = {
  waiting: NAMES.needsYou,
  running: NAMES.running,
  queued: NAMES.queued,
  ready: NAMES.ready,
  paused: NAMES.paused,
  failed: NAMES.failed,
  stopping: NAMES.stopping,
  stopped: NAMES.stopped,
  done: NAMES.done,
  idle: NAMES.idle,
  skipped: NAMES.skipped,
};

const TONE: Record<GlanceState, Tone> = {
  waiting: AUTO_STATE_TONE.waitingOnYou,
  running: AUTO_STATE_TONE.running,
  queued: AUTO_STATE_TONE.idle,
  ready: AUTO_STATE_TONE.idle,
  paused: AUTO_STATE_TONE.waitingOnYou,
  failed: AUTO_STATE_TONE.failed,
  stopping: AUTO_STATE_TONE.idle,
  stopped: AUTO_STATE_TONE.idle,
  done: AUTO_STATE_TONE.done,
  idle: AUTO_STATE_TONE.idle,
  skipped: AUTO_STATE_TONE.idle,
};

export const glanceOf = ({ state, sentence, word = WORD[state] }: Params): Glance => ({
  state,
  word,
  tone: TONE[state],
  sentence,
  isLive: state === 'running',
});
