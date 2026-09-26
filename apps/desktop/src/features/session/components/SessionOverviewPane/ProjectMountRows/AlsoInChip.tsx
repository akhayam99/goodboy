import { Chip, StatusDot, Tooltip } from '@goodboy/ui';
import type { ProjectId, Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionStageInfo } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { describeSessionStage } from '../../../session-stage';
import { selectAlsoOnBranchSessionId } from '../../../../../store/slices/project-mounts/selectors';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

type ContentProps = {
  readonly session: Session;
};

const AlsoInChipContent = ({ session }: ContentProps) => {
  const stage = useSessionStageInfo(session);
  const presentation = describeSessionStage(stage);
  const navigate = useAppStore((state) => state.navigate);

  return (
    <Tooltip content={`Also in ${session.goal}`}>
      <Chip
        as="button"
        tone="neutral"
        shape="badge"
        size="control"
        onClick={() => navigate({ to: sessionPlace({ sessionId: session.id }) })}
        className="min-w-0 shrink gap-1.5 hover:bg-hover hover:text-foreground"
        label={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-faint-foreground">Also in</span>
            <StatusDot tone={presentation.tone} size="sm" />
            <span className="min-w-0 truncate">{session.goal}</span>
          </span>
        }
      />
    </Tooltip>
  );
};

export const AlsoInChip = ({ sessionId, projectId, branch }: Props) => {
  const otherSessionId = useAppStore((state) =>
    selectAlsoOnBranchSessionId({ state, sessionId, projectId, branch }),
  );
  const otherSession = useAppStore((state) =>
    otherSessionId === null
      ? null
      : (state.sessions.find((candidate) => candidate.id === otherSessionId) ?? null),
  );

  if (otherSession === null) {
    return null;
  }

  return <AlsoInChipContent session={otherSession} />;
};
