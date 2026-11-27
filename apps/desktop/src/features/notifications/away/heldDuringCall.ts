import type { SessionAttentionReason } from '@goodboy/types';
import type { AwayBanner } from './awayBannersOf';

const RELEASE_BLOCKING: ReadonlySet<SessionAttentionReason> = new Set<SessionAttentionReason>([
  'ci-failed',
  'push-failed',
]);

export type CallQuiet = Readonly<{
  eventId: string;
  until: number;
}>;

type Params = {
  readonly banners: ReadonlyArray<AwayBanner>;
  readonly quiet: CallQuiet | null;
  readonly now: number;
};

type Split = Readonly<{
  shown: ReadonlyArray<AwayBanner>;
  held: ReadonlyArray<AwayBanner>;
}>;

type BannerParams = {
  readonly banner: AwayBanner;
};

const isReleaseBlocking = ({ banner }: BannerParams): boolean =>
  banner.reason !== null && RELEASE_BLOCKING.has(banner.reason);

export const heldDuringCall = ({ banners, quiet, now }: Params): Split => {
  if (quiet === null || now >= quiet.until) {
    return { shown: banners, held: [] };
  }
  return {
    shown: banners.filter((banner) => isReleaseBlocking({ banner })),
    held: banners.filter((banner) => !isReleaseBlocking({ banner })),
  };
};
