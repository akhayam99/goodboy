import { Chip, StatusDot, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionStageInfo } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { describeSessionStage } from '../../../session-stage';
import { sessionTitle } from '../../../sessionTitle';

type Props = {
  readonly session: Session;
};

export const AlsoInChipContent = ({ session }: Props) => {
  const stage = useSessionStageInfo(session);
  const presentation = describeSessionStage(stage);
  const navigate = useAppStore((state) => state.navigate);
  const title = sessionTitle({ session });

  return (
    <Tooltip content={`Also in ${title}`}>
      <Chip
        as="button"
        tone="neutral"
        shape="badge"
        size="control"
        onClick={() => navigate({ to: sessionPlace({ sessionId: session.id }) })}
        className="min-w-0 shrink gap-2 hover:bg-hover hover:text-foreground"
        label={
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-faint-foreground">Also in</span>
            <StatusDot tone={presentation.tone} size="sm" />
            <span className="min-w-0 truncate">{title}</span>
          </span>
        }
      />
    </Tooltip>
  );
};
