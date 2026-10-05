import type { ArtifactId, MountId, SessionId } from '@goodboy/types';
import type { ExploreEntry } from '../../../features/explore/explore';

export type ArtifactDrawerTab = 'details' | 'chat';

export type ContextDrawerTab = 'goal' | 'decisions' | 'summary' | 'learned';

export type ContextDrawerView = 'current' | 'versions';

export type DrawerContent =
  | {
      readonly kind: 'context';
      readonly payload: {
        readonly tab: ContextDrawerTab;
        readonly view: ContextDrawerView;
        readonly highlight?: ReadonlyArray<number>;
      };
    }
  | {
      readonly kind: 'explore-file';
      readonly payload: { readonly sessionDir: string; readonly entry: ExploreEntry };
    }
  | {
      readonly kind: 'artifact';
      readonly payload: { readonly artifactId: ArtifactId; readonly tab: ArtifactDrawerTab };
    }
  | {
      readonly kind: 'artifact-document';
      readonly payload: { readonly artifactId: ArtifactId; readonly revision: number | null };
    }
  | {
      readonly kind: 'plan-part';
      readonly payload: { readonly planId: ArtifactId; readonly index: number };
    }
  | {
      readonly kind: 'scriptRun';
      readonly payload: { readonly scriptKey: string; readonly mountId: MountId | null };
    }
  | {
      readonly kind: 'conversation';
      readonly payload: { readonly threadId: string };
    }
  | {
      readonly kind: 'file-diff';
      readonly payload: { readonly source: FileDiffSource; readonly path: string | null };
    };

export type FileDiffSource =
  | { readonly kind: 'worktree'; readonly worktreePath: string }
  | { readonly kind: 'commit'; readonly repo: string; readonly sha: string };

export type DrawerRequest = DrawerContent & {
  readonly sessionId: SessionId;
};

export type OpenDrawer = DrawerRequest;

export type DrawerSliceState = {
  readonly drawer: OpenDrawer | null;
  readonly documentDrawerExpanded: Readonly<Record<SessionId, boolean>>;
};

export const initialDrawerState: DrawerSliceState = {
  drawer: null,
  documentDrawerExpanded: {},
};
