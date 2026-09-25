import type { SlotKey } from '@goodboy/core';
import type { ArtifactId, MountId, SessionId } from '@goodboy/types';
import type { ExploreEntry } from '../../../features/explore/explore';
import type { LensKind } from '../session-view/types';

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
    };

export type DrawerRequest = DrawerContent & {
  readonly sessionId: SessionId;
};

export type OpenDrawer = DrawerRequest & {
  readonly lens: LensKind | null;
};

export type DrawerSliceState = {
  readonly drawer: OpenDrawer | null;
};

export const initialDrawerState: DrawerSliceState = {
  drawer: null,
};
