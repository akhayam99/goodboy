import type { Tone } from '@goodboy/ui';
import { AUTO_STATE_TONE } from '../../auto/chat/autoStateTone';

export type GlanceState =
  'waiting' | 'planning' | 'working' | 'stuck' | 'stopped' | 'done' | 'idle';

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
};

const WORD: Record<GlanceState, string> = {
  waiting: 'Needs you',
  planning: 'Planning',
  working: 'Working',
  stuck: 'Stuck',
  stopped: 'Stopped',
  done: 'Done',
  idle: 'Idle',
};

const TONE: Record<GlanceState, Tone> = {
  waiting: AUTO_STATE_TONE.waitingOnYou,
  planning: AUTO_STATE_TONE.running,
  working: AUTO_STATE_TONE.running,
  stuck: AUTO_STATE_TONE.failed,
  stopped: AUTO_STATE_TONE.idle,
  done: AUTO_STATE_TONE.done,
  idle: AUTO_STATE_TONE.idle,
};

export const glanceOf = ({ state, sentence }: Params): Glance => ({
  state,
  word: WORD[state],
  tone: TONE[state],
  sentence,
  isLive: state === 'planning' || state === 'working',
});
