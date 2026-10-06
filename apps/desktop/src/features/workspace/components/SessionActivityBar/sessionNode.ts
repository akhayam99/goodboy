import type { Tone, WorkNodeMark, WorkNodeState } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';

type SessionNodeKind = 'needs' | 'running' | 'done' | 'idle' | 'archived';

export type SessionNode = {
  readonly kind: SessionNodeKind;
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly tone: Tone;
  readonly label: string;
};

type Params = {
  readonly stage: SessionStage;
  readonly attention: SessionAttentionReason | null;
  readonly isArchived: boolean;
};

const RING_ONLY: WorkNodeMark = { kind: 'glyph', glyph: null };
const RUNNING_DOT: WorkNodeMark = { kind: 'dot' };

const FAILED_REASONS: ReadonlyArray<SessionAttentionReason> = [
  'agent-error',
  'ci-failed',
  'fix-couldnt-fix',
  'changes-requested',
];

const needsStateOf = ({ attention }: Pick<Params, 'attention'>): WorkNodeState => {
  if (attention === 'needs-approval') {
    return 'approval';
  }
  if (attention !== null && FAILED_REASONS.includes(attention)) {
    return 'failed';
  }
  return 'question';
};

export const sessionNodeOf = ({ stage, attention, isArchived }: Params): SessionNode => {
  if (isArchived) {
    return {
      kind: 'archived',
      state: 'queued',
      mark: RING_ONLY,
      tone: 'neutral',
      label: 'Archived',
    };
  }
  if (stage === 'attention') {
    const state = needsStateOf({ attention });
    return {
      kind: 'needs',
      state,
      mark: RING_ONLY,
      tone: state === 'failed' ? 'danger' : 'warning',
      label: NAMES.needsYou,
    };
  }
  if (stage === 'running') {
    return {
      kind: 'running',
      state: 'running',
      mark: RUNNING_DOT,
      tone: 'info',
      label: NAMES.running,
    };
  }
  if (stage === 'done') {
    return { kind: 'done', state: 'closed', mark: RING_ONLY, tone: 'neutral', label: NAMES.done };
  }
  return { kind: 'idle', state: 'marker', mark: RING_ONLY, tone: 'neutral', label: 'Idle' };
};
