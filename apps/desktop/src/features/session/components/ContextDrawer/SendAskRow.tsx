import { formatTokens } from '@goodboy/ui';
import { ASK_LIVE_BUDGET_TOKENS } from '../../ask/ASK_LIVE_BUDGET_TOKENS';
import { NAMES } from '../../../../shared/utils/names';

export const SendAskRow = () => (
  <div data-send-row="ask" className="flex items-start gap-3 rounded-lg px-2 py-2">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate">{NAMES.askAgent}</span>
      <span className="text-meta text-muted-foreground">
        Live work: tool calls, checks, worktrees and scripts
      </span>
    </div>
    <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
      {`Up to ${formatTokens(ASK_LIVE_BUDGET_TOKENS)} tokens`}
    </span>
  </div>
);
