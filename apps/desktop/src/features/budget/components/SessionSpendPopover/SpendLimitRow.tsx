import { Button, cn, formatUsd, tintClasses } from '@goodboy/ui';
import type { SessionBudget, SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';
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
  const fill = Math.min(presentation.ratio ?? 0, 1) * 100;

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
        <p className="text-meta text-muted-foreground">No limit</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            role="meter"
            aria-label="Spent of the limit"
            aria-valuemin={0}
            aria-valuemax={limit.softCapUsd}
            aria-valuenow={Math.min(totalUsd, limit.softCapUsd)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-fill"
          >
            <div
              className={cn(
                'h-full rounded-full',
                presentation.tone === 'neutral'
                  ? 'bg-primary'
                  : tintClasses(presentation.tone).solid,
              )}
              style={{ width: `${fill}%` }}
            />
          </div>
          <p className="font-mono text-meta tabular-nums text-muted-foreground">
            {`${formatUsd(totalUsd)} of ${formatUsd(limit.softCapUsd)} · ${SPEND_LIMIT_BEHAVIOR_LABEL[limit.onExceed]}`}
          </p>
        </div>
      )}
    </section>
  );
};
