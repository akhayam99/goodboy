import { leadStopOf, type LeadStopState } from '@goodboy/core/auto';
import type { TurnState } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { isAutoBlockRecovered } from './isAutoBlockRecovered';
import { isAutoPausedAtLimit } from './isAutoPausedAtLimit';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { projectAskOf } from './chat/projectAskOf';
import { needsYouRoleNouns } from './needsYouRoleNouns';
import { leadStopWordOf } from '../session/leadStopWordOf';

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
};

type AutoFace = Readonly<{
  state: AutoTreeState;
  node: WorkNodeState;
}>;

const AUTO_FACES = {
  stopping: { state: 'stopping', node: 'stopped' },
  stopped: { state: 'stopped', node: 'stopped' },
  done: { state: 'done', node: 'done' },
  failed: { state: 'failed', node: 'failed' },
  idle: { state: 'idle', node: 'queued' },
  asking: { state: 'asking', node: 'approval' },
  paused: { state: 'paused', node: 'budget' },
  running: { state: 'running', node: 'running' },
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

export const autoTreeWordOf = ({ view, rootTurn }: Params): AutoTreeWord => {
  const lead = leadStopOf({
    phase: view.tree.phase,
    isRootTurnLive: rootTurn?.kind === 'running' || rootTurn?.kind === 'starting',
    isPlanReady: isAutoPlanAwaitingApproval({ view }),
    isAsking:
      projectAskOf({ view }) !== null ||
      needsYouRoleNouns({ delegations: view.delegations }).length > 0,
    isPausedAtLimit: isAutoPausedAtLimit({ view }),
    isHeld: view.hold != null,
    isBlockRecovered: isAutoBlockRecovered({ delegations: view.delegations }),
  });
  const face = AUTO_FACES[autoStateOf({ lead })];
  return {
    state: face.state,
    word: leadStopWordOf({ lead }),
    node: face.node,
    isLive: face.state === 'running',
    lead,
  };
};
