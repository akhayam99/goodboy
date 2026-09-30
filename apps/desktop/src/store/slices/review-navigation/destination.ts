import type { MountId } from '@goodboy/types';

export type ReviewDestination =
  | { readonly kind: 'home' }
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
  destination.kind === 'home' ? null : destination.mountId;

export const reviewPrNumber = ({ destination }: Params): number | null =>
  destination.kind === 'pull_request' ||
  destination.kind === 'comments' ||
  destination.kind === 'thread'
    ? destination.prNumber
    : null;

export const reviewThreadId = ({ destination }: Params): string | null =>
  destination.kind === 'thread' ? destination.threadId : null;

export const reviewThreadIds = ({ destination }: Params): ReadonlyArray<string> =>
  destination.kind === 'threads'
    ? destination.threadIds
    : destination.kind === 'thread'
      ? [destination.threadId]
      : [];

export const reviewFocusThreadId = ({
  destination,
  isPresent = () => true,
}: Params & { readonly isPresent?: (threadId: string) => boolean }): string | null =>
  reviewThreadIds({ destination }).find(isPresent) ?? null;
