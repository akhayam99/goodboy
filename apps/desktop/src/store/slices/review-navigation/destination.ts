import type { MountId } from '@goodboy/types';
import { noteIdOfThread } from '../../../features/resolve/notes/noteThread';

export type ReviewDestination =
  | { readonly kind: 'home' }
  | { readonly kind: 'notes'; readonly threadIds: ReadonlyArray<string> }
  | { readonly kind: 'mount'; readonly mountId: MountId }
  | {
      readonly kind: 'pull_request';
      readonly mountId: MountId | null;
      readonly prNumber: number;
    }
  | {
      readonly kind: 'comments';
      readonly mountId: MountId | null;
      readonly prNumber: number;
    }
  | {
      readonly kind: 'thread';
      readonly mountId: MountId | null;
      readonly prNumber: number;
      readonly threadId: string;
    }
  | {
      readonly kind: 'threads';
      readonly mountId: MountId | null;
      readonly threadIds: ReadonlyArray<string>;
    };

type Params = {
  readonly destination: ReviewDestination;
};

export const REVIEW_HOME: ReviewDestination = { kind: 'home' };

export const reviewMountId = ({ destination }: Params): MountId | null =>
  destination.kind === 'home' || destination.kind === 'notes' ? null : destination.mountId;

export const reviewPrNumber = ({ destination }: Params): number | null =>
  destination.kind === 'pull_request' ||
  destination.kind === 'comments' ||
  destination.kind === 'thread'
    ? destination.prNumber
    : null;

export const reviewThreadId = ({ destination }: Params): string | null =>
  destination.kind === 'thread' ? destination.threadId : null;

export const reviewThreadIds = ({ destination }: Params): ReadonlyArray<string> =>
  destination.kind === 'threads' || destination.kind === 'notes'
    ? destination.threadIds
    : destination.kind === 'thread'
      ? [destination.threadId]
      : [];

export const reviewFocusThreadId = ({
  destination,
  isPresent = () => true,
}: Params & { readonly isPresent?: (threadId: string) => boolean }): string | null =>
  reviewThreadIds({ destination }).find(isPresent) ?? null;

export const isNotesDestination = ({ destination }: Params): boolean => {
  if (destination.kind === 'notes') {
    return true;
  }
  if (destination.kind !== 'threads' || destination.threadIds.length === 0) {
    return false;
  }
  return destination.threadIds.every((threadId) => noteIdOfThread({ threadId }) !== null);
};
