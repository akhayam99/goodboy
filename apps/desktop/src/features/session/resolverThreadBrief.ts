import { resolverReplySummary } from './resolverReplySummary';
import { resolverThreadDecisions } from './resolverThreadDecisions';
import { markdownPreview } from '../../shared/utils/markdownPreview';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

export type ResolverThreadBrief = {
  readonly ask: string;
  readonly verdict: string;
  readonly next: string;
};

type Params = {
  readonly settlement: ResolverThreadSettlement;
  readonly commentBody: string | null;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
};

const VERDICT_LEAD: Record<ResolverThreadSettlementKind, string> = {
  resolved: 'Committed a fix',
  wontfix: 'No change needed',
  analyzed: 'Answered without a change',
  open: 'No outcome recorded',
};

export const resolverThreadBrief = ({
  settlement,
  commentBody,
  prNumber,
  isBusy,
}: Params): ResolverThreadBrief => {
  const detail = markdownPreview({ text: settlement.reason ?? settlement.reply ?? '' });
  const lead = VERDICT_LEAD[settlement.kind];

  return {
    ask: resolverReplySummary({ text: commentBody ?? '' }),
    verdict: detail === '' ? lead : `${lead}: ${detail}`,
    next: resolverThreadDecisions({ settlement, prNumber, isBusy, actLockReason: null }).question,
  };
};
