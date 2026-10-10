import type { SessionId } from '@goodboy/types';
import type { ExploreFileActionTarget } from '../actions/types';
import type { ExploreEntry } from './explore';
import type { ExploreOpenAction } from './openAction';

type JoinParams = {
  readonly root: string;
  readonly relPath: string;
};

export const joinExplorePath = ({ root, relPath }: JoinParams): string => {
  if (relPath === '') {
    return root;
  }
  if (root.endsWith('/') || root.endsWith('\\')) {
    return `${root}${relPath}`;
  }
  return `${root}/${relPath}`;
};

type Params = {
  readonly sessionId: SessionId;
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
  readonly openAction: ExploreOpenAction | null;
  readonly onAsk: (() => void) | null;
  readonly onOpen: () => void;
  readonly onReveal: () => void;
};

export const exploreFileTargetOf = ({
  sessionId,
  sessionDir,
  entry,
  openAction,
  onAsk,
  onOpen,
  onReveal,
}: Params): ExploreFileActionTarget => ({
  kind: 'exploreFile',
  sessionId,
  facts: {
    name: entry.name,
    relPath: entry.relPath,
    absolutePath: joinExplorePath({ root: sessionDir, relPath: entry.relPath }),
    isDir: entry.isDir,
    openLabel: openAction?.label ?? null,
    editorLabel: openAction?.editor?.label ?? null,
    onAsk: entry.isDir ? null : onAsk,
    onOpen: openAction === null ? null : onOpen,
    onReveal,
  },
});
