import { leadStopOf, type LeadStopState } from '@goodboy/core/auto';
import type { TurnState } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { isAutoPausedAtLimit } from './isAutoPausedAtLimit';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { projectAskOf } from './chat/projectAskOf';

export type AutoTreeState =
  'stopping' | 'stopped' | 'done' | 'failed' | 'idle' | 'asking' | 'paused' | 'running';

export type AutoTreeWord = Readonly<{
  state: AutoTreeState;
  word: string;
  node: WorkNodeState;
  isLive: boolean;
  lead: LeadStopState;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
  readonly isWork: boolean;
};

type AutoFace = Readonly<{
  state: AutoTreeState;
  word: string;
  node: WorkNodeState;
}>;

const AUTO_FACES = {
  stopping: { state: 'stopping', word: NAMES.stopping, node: 'stopped' },
  stopped: { state: 'stopped', word: NAMES.stopped, node: 'stopped' },
  done: { state: 'done', word: NAMES.done, node: 'done' },
  failed: { state: 'failed', word: NAMES.failed, node: 'failed' },
  idle: { state: 'idle', word: NAMES.idle, node: 'queued' },
  asking: { state: 'asking', word: NAMES.needsYou, node: 'approval' },
  paused: { state: 'paused', word: NAMES.paused, node: 'budget' },
  running: { state: 'running', word: NAMES.running, node: 'running' },
} as const satisfies Readonly<Record<AutoTreeState, AutoFace>>;

type FaceParams = {
  readonly lead: LeadStopState;
};

const autoStateOf = ({ lead }: FaceParams): AutoTreeState => {
  switch (lead.stop) {
    case 'stopped':
      return lead.reason === 'stopping' ? 'stopping' : 'stopped';
    case 'finished':
      return 'done';
    case 'resting':
      return 'idle';
    case 'working':
      return 'running';
    case 'waitsForYou':
      if (lead.reason === 'failed') {
        return 'failed';
      }
      return lead.reason === 'limit' ? 'paused' : 'asking';
    default: {
      const exhaustive: never = lead.stop;
      return exhaustive;
    }
  }
};

export const autoTreeWordOf = ({ view, rootTurn, isWork }: Params): AutoTreeWord => {
  const lead = leadStopOf({
    phase: view.tree.phase,
    isRootTurnLive: rootTurn?.kind === 'running' || rootTurn?.kind === 'starting',
    isPlanReady: isAutoPlanAwaitingApproval({ view }),
    isAsking: projectAskOf({ view }) !== null,
    isPausedAtLimit: isAutoPausedAtLimit({ view }),
  });
  const face = AUTO_FACES[autoStateOf({ lead })];
  return {
    state: face.state,
    word: isWork ? lead.word : face.word,
    node: face.node,
    isLive: face.state === 'running',
    lead,
  };
};
