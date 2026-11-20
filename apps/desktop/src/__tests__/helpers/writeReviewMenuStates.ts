import type { IsoDateTime, PrReviewDraft, SessionExternalTask, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly createdAt: IsoDateTime;
};

type WriteReviewState = {
  readonly draft: PrReviewDraft;
  readonly link: SessionExternalTask;
};

export const writeReviewStateOf = ({ sessionId, createdAt }: Params): WriteReviewState => ({
  draft: {
    id: 'draft-1',
    sessionId,
    provider: 'github',
    repo: 'harborline/ledger-core',
    prNumber: 482,
    path: 'src/payouts/export.ts',
    line: 40,
    startLine: null,
    side: 'new',
    body: 'Stream the rows instead of buffering them.',
    status: 'draft',
    stale: false,
    origin: 'user',
    createdAt,
  },
  link: {
    sessionId,
    provider: 'github',
    externalId: '482',
    identifier: '#482',
    url: 'https://github.com/harborline/ledger-core/pull/482',
    title: 'Stream the payout export',
    createdAt,
  },
});
