import type { WorkNodeMark } from '@goodboy/ui';
import type { StateNodeSpec } from '../../shared/components/StateNode';

type Params = {
  readonly isStreaming: boolean;
  readonly isUnread: boolean;
};

const RING_ONLY: WorkNodeMark = { kind: 'glyph', glyph: null };

const ANSWERING: StateNodeSpec = {
  kind: 'answering',
  state: 'running',
  mark: { kind: 'dot' },
  tone: 'info',
  label: 'Answering',
  isSpinning: false,
  hasUnread: false,
};

const UNREAD: StateNodeSpec = {
  kind: 'unread',
  state: 'marker',
  mark: RING_ONLY,
  tone: 'neutral',
  label: 'New reply',
  isSpinning: false,
  hasUnread: true,
};

const IDLE: StateNodeSpec = {
  kind: 'idle',
  state: 'marker',
  mark: RING_ONLY,
  tone: 'neutral',
  label: 'No new reply',
  isSpinning: false,
  hasUnread: false,
};

export const chatNodeOf = ({ isStreaming, isUnread }: Params): StateNodeSpec => {
  if (isStreaming) {
    return ANSWERING;
  }
  if (isUnread) {
    return UNREAD;
  }
  return IDLE;
};
