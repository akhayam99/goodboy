import type { WorkspaceId } from '@goodboy/types';
import type { WorkspaceAttentionMap } from './state';

type Params = {
  readonly byWorkspace: WorkspaceAttentionMap;
  readonly currentId: WorkspaceId | null;
};

export type AttentionElsewhere = {
  readonly count: number;
  readonly tone: 'danger' | 'warning' | null;
};

export const attentionElsewhereOf = ({ byWorkspace, currentId }: Params): AttentionElsewhere => {
  const others = Object.entries(byWorkspace)
    .filter(([id]) => id !== currentId)
    .map(([, entry]) => entry);
  const hasDanger = others.some((entry) => entry.tone === 'danger');
  const tone = hasDanger ? 'danger' : 'warning';
  return {
    count: others.reduce((sum, entry) => sum + entry.count, 0),
    tone: others.length === 0 ? null : tone,
  };
};
