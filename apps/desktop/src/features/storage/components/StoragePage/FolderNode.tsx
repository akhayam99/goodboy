import { Check, CircleHelp, FolderOpen, TriangleAlert } from 'lucide-react';
import { WORK_NODE_GLYPH_SIZE, WorkNode, type WorkNodeMark, type WorkNodeState } from '@goodboy/ui';
import type { StorageFolderStatus } from '../../../../store/slices/storage/types';

type NodeSpec = {
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
};

const NODE = {
  'in-use': {
    state: 'closed',
    mark: {
      kind: 'glyph',
      glyph: <FolderOpen size={WORK_NODE_GLYPH_SIZE} className="text-muted-foreground" />,
    },
  },
  checking: { state: 'queued', mark: { kind: 'dot' } },
  safe: {
    state: 'done',
    mark: { kind: 'glyph', glyph: <Check size={WORK_NODE_GLYPH_SIZE} className="text-success" /> },
  },
  dirty: {
    state: 'question',
    mark: {
      kind: 'glyph',
      glyph: <TriangleAlert size={WORK_NODE_GLYPH_SIZE} className="text-warning" />,
    },
  },
  operation: {
    state: 'question',
    mark: {
      kind: 'glyph',
      glyph: <TriangleAlert size={WORK_NODE_GLYPH_SIZE} className="text-warning" />,
    },
  },
  unavailable: {
    state: 'question',
    mark: {
      kind: 'glyph',
      glyph: <TriangleAlert size={WORK_NODE_GLYPH_SIZE} className="text-warning" />,
    },
  },
  'not-tracked': {
    state: 'question',
    mark: {
      kind: 'glyph',
      glyph: <CircleHelp size={WORK_NODE_GLYPH_SIZE} className="text-warning" />,
    },
  },
  writing: { state: 'running', mark: { kind: 'dot' } },
} as const satisfies Record<StorageFolderStatus, NodeSpec>;

type Props = {
  readonly status: StorageFolderStatus;
  readonly label: string;
};

export const FolderNode = ({ status, label }: Props) => {
  const spec: NodeSpec = NODE[status];
  return <WorkNode state={spec.state} mark={spec.mark} label={label} />;
};
