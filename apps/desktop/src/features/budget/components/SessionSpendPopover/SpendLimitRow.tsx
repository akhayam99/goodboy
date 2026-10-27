import { EmptyLine, Button, Meter, formatUsd } from '@goodboy/ui';
import type { SessionBudget, SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { SPEND_LIMIT_BEHAVIOR_LABEL } from '../../spendLimitBehavior';
import { sessionSpendPresentation } from '../../sessionSpendPresentation';
import { SpendLimitEditor } from './SpendLimitEditor';

type Props = {
  readonly sessionId: SessionId;
  readonly totalUsd: number;
  readonly limit: SessionBudget | null;
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
};

export const SpendLimitRow = ({
  sessionId,
  totalUsd,
  limit,
  isEditing,
  onEditingChange,
}: Props) => {
  const presentation = sessionSpendPresentation({ totalUsd, limit });

  return (
    <section aria-label={NAMES.spendCap} className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-row text-foreground">{NAMES.spendCap}</span>
        {isEditing ? null : (
          <Button variant="ghost" size="sm" onClick={() => onEditingChange(true)}>
            {limit === null ? 'Set limit' : 'Edit'}
          </Button>
        )}
      </div>
      {isEditing ? (
        <SpendLimitEditor
          sessionId={sessionId}
          limit={limit}
          onDone={() => onEditingChange(false)}
        />
      ) : limit === null ? (
        <EmptyLine className="text-meta text-muted-foreground">No limit</EmptyLine>
      ) : (
        <div className="flex flex-col gap-2">
          <Meter
            label="Spent of the limit"
            value={totalUsd}
            max={limit.softCapUsd}
            tone={presentation.tone === 'neutral' ? 'primary' : presentation.tone}
            className="w-full"
          />
          <p className="text-meta tabular-nums text-muted-foreground">
            {`${formatUsd(totalUsd)} of ${formatUsd(limit.softCapUsd)} · ${SPEND_LIMIT_BEHAVIOR_LABEL[limit.onExceed]}`}
          </p>
        </div>
      )}
    </section>
  );
};
