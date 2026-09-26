import { Button, Divider, Eyebrow, ScrollFade, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionBudget, SessionId } from '@goodboy/types';
import type { SessionSpendBreakdown } from '../../sessionSpendByAgent';
import { SpendLimitRow } from './SpendLimitRow';
import { AgentSpendList } from './AgentSpendList';

type Props = {
  readonly sessionId: SessionId;
  readonly spend: SessionSpendBreakdown;
  readonly limit: SessionBudget | null;
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
  readonly onOpenImpact: () => void;
};

export const SessionSpendPopover = ({
  sessionId,
  spend,
  limit,
  isEditing,
  onEditingChange,
  onOpenImpact,
}: Props) => (
  <>
    <div className="flex items-end justify-between gap-2 px-4 pb-3 pt-3.5">
      <div className="flex flex-col gap-1">
        <Eyebrow label="Spend" />
        <span
          title={formatUsdPrecise(spend.totalUsd)}
          className="font-mono text-title tabular-nums text-foreground"
        >
          {formatUsd(spend.totalUsd)}
        </span>
      </div>
      <span className="text-secondary text-muted-foreground">this session</span>
    </div>
    <Divider />
    <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col gap-4 p-4">
      <SpendLimitRow
        sessionId={sessionId}
        totalUsd={spend.totalUsd}
        limit={limit}
        isEditing={isEditing}
        onEditingChange={onEditingChange}
      />
      <AgentSpendList agents={spend.agents} />
      {spend.contextUsd > 0 ? (
        <p className="text-secondary text-faint-foreground">
          {`Keeping context up to date: ${formatUsd(spend.contextUsd)}`}
        </p>
      ) : null}
    </ScrollFade>
    <Divider />
    <div className="flex items-center px-3 py-2">
      <Button variant="ghost" size="sm" onClick={onOpenImpact}>
        Open in Impact
      </Button>
    </div>
  </>
);
