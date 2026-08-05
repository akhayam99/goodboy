import type { IsoDateTime, SessionId } from '@goodboy/types';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../../../features/integrations/bitbucket/client';

export type SessionBitbucketPrEntry = {
  readonly pr: BitbucketPullRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type BitbucketPrSliceState = {
  readonly sessionBitbucketPr: Readonly<Record<SessionId, SessionBitbucketPrEntry>>;
  readonly sessionBitbucketRepo: Readonly<Record<SessionId, BitbucketRepo>>;
  readonly sessionSelectedBitbucketPrId: Readonly<Record<SessionId, number | null>>;
};

export const initialBitbucketPrState: BitbucketPrSliceState = {
  sessionBitbucketPr: {},
  sessionBitbucketRepo: {},
  sessionSelectedBitbucketPrId: {},
};

type EntryParams = {
  readonly entry: SessionBitbucketPrEntry | undefined;
};

export const carryForward = ({ entry }: EntryParams): SessionBitbucketPrEntry => ({
  pr: entry?.pr ?? null,
  fetchedAt: entry?.fetchedAt ?? null,
  loading: false,
  error: null,
});
