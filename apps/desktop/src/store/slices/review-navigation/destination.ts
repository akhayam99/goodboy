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
      readonly kind: 'thread';
      readonly mountId: MountId | null;
      readonly prNumber: number;
      readonly threadId: string;
    };

type Params = {
  readonly destination: ReviewDestination;
};

export const REVIEW_HOME: ReviewDestination = { kind: 'home' };

export const reviewMountId = ({ destination }: Params): MountId | null =>
  destination.kind === 'home' ? null : destination.mountId;

export const reviewPrNumber = ({ destination }: Params): number | null =>
  destination.kind === 'pull_request' || destination.kind === 'thread'
    ? destination.prNumber
    : null;

export const reviewThreadId = ({ destination }: Params): string | null =>
  destination.kind === 'thread' ? destination.threadId : null;
