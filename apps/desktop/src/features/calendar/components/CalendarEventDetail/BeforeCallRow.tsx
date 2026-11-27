import { Button, StatusMark, TruncatedText, type StatusMarkSpec } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionStageInfo } from '../../../../store';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { attentionMarkOf } from '../../../session/attentionMarkOf';
import { attentionPlace } from '../../../session/attentionPlace';
import { attentionWordsOf } from '../../../session/session-stage';

type Props = {
  readonly session: Session;
};

export const BeforeCallRow = ({ session }: Props) => {
  const info = useSessionStageInfo(session);
  const { attention } = info;
  const words =
    attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info });
  const mark: StatusMarkSpec =
    attention === null ? { kind: 'dot', tone: 'warning' } : attentionMarkOf({ reason: attention });
  const title = sessionTitle({ session });
  const sessionId = session.id as SessionId;

  return (
    <li data-before-call={sessionId} className="flex min-h-7 min-w-0 items-center gap-2">
      <span className="inline-flex shrink-0 text-faint-foreground">
        <StatusMark mark={mark} />
      </span>
      <TruncatedText className="min-w-0 flex-1 text-meta text-foreground">
        {joinFacts({ facts: [title, words] })}
      </TruncatedText>
      <Button
        variant="ghost"
        size="xs"
        aria-label={`Open ${title}`}
        onClick={() => {
          const state = useAppStore.getState();
          state.navigate({ to: attentionPlace({ state, sessionId, reason: attention }) });
        }}
      >
        Open
      </Button>
    </li>
  );
};
