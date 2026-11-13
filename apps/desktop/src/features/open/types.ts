import type { SessionId } from '@goodboy/types';
import type { LinksOpen } from '../../shared/lib/linksOpenSetting';

export type SavedCopyKind = 'document' | 'wireframe';

export type OpenTarget =
  | { readonly kind: 'web'; readonly url: string }
  | {
      readonly kind: 'file';
      readonly path: string;
      readonly root: string;
      readonly line: number | null;
    }
  | {
      readonly kind: 'saved-copy';
      readonly copy: SavedCopyKind;
      readonly name: string;
      readonly workspaceSlug: string;
      readonly folder: string;
      readonly file: string;
    };

export type LaunchTarget = Exclude<OpenTarget, { readonly kind: 'file' }>;

export type OpenPlace = 'beside-session' | 'your-browser' | 'editor';

export type OpenForcedPlace = 'outside';

export type OpenResult =
  | { readonly status: 'opened'; readonly place: OpenPlace }
  | { readonly status: 'failed'; readonly reason: string };

export type OpenClick = Pick<MouseEvent, 'metaKey' | 'ctrlKey'>;

export type OpenPlaceParams = {
  readonly target: OpenTarget;
  readonly mode: LinksOpen;
  readonly isOwnClick: boolean;
  readonly sessionId: SessionId | null;
};
