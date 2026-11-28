import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { formatDuration } from '../../../shared/utils/time/formatDuration';
import { HOME_WIDGETS, type WidgetSize } from '../grid/homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';
import { useLongRunning } from '../hooks/useLongRunning';
import { openSessionPlace } from '../openSessionPlace';
import { HeroNumber } from '../WidgetCard/HeroNumber';
import { WidgetCard } from '../WidgetCard';
import { WidgetRow } from '../WidgetCard/WidgetRow';
import { WidgetSkeleton } from '../WidgetCard/WidgetSkeleton';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

export const LongRunning = ({ facts, size }: Props) => {
  const rows = useLongRunning({ facts });
  const [first] = rows;
  const hours = first === undefined ? '' : (formatDuration({ durationMs: first.activeMs }) ?? '');
  return (
    <WidgetCard
      id="longRunning"
      title={HOME_WIDGETS.longRunning.title}
      icon={CONCEPT_ICONS.runs}
      count={facts.isLoading ? 0 : rows.length}
      tone="warning"
      footer={
        size === 'M' && first !== undefined ? (
          <Button
            size="xs"
            variant="quiet"
            onClick={() => openSessionPlace({ sessionId: first.session.id })}
          >
            Open session
          </Button>
        ) : undefined
      }
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading long running sessions" />
      ) : first === undefined ? null : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HeroNumber value={hours} unit="active" />
          <span className="truncate text-meta text-faint-foreground">
            {sessionTitle({ session: first.session })}
          </span>
        </div>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col">
          <WidgetRow
            lead={null}
            title={sessionTitle({ session: first.session })}
            meta={`Active for ${hours}`}
            label={`Open ${sessionTitle({ session: first.session })}, long running`}
            onOpen={() => openSessionPlace({ sessionId: first.session.id })}
          />
        </ul>
      )}
    </WidgetCard>
  );
};
