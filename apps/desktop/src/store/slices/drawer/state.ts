import type { SlotKey } from '@goodboy/core';
import type { ArtifactId, MountId, SessionId } from '@goodboy/types';
import type { ExploreEntry } from '../../../features/explore/explore';

export type ArtifactDrawerTab = 'details' | 'chat';

export type DrawerContent =
  | {
      readonly kind: 'slot-history';
      readonly payload: { readonly slotKey: SlotKey };
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
      readonly kind: 'plan-part';
      readonly payload: { readonly planId: ArtifactId; readonly index: number };
    }
  | {
      readonly kind: 'scriptRun';
      readonly payload: { readonly scriptKey: string; readonly mountId: MountId | null };
    }
  | {
      readonly kind: 'diff-notes';
      readonly payload: Readonly<Record<string, never>>;
    }
  | {
      readonly kind: 'review-drafts';
      readonly payload: Readonly<Record<string, never>>;
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
};

export const initialDrawerState: DrawerSliceState = {
  drawer: null,
};
