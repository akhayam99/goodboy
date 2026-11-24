import {
  cn,
  InlineMarkdown,
  isKeyboardFocus,
  ROW_INTERACTIVE,
  StatusMark,
  type StatusMarkSpec,
  type Tone,
} from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../../store';
import {
  ATTENTION_REASON_META,
  attentionWordsOf,
} from '../../../../features/session/session-stage';
import { attentionMarkOf } from '../../../../features/session/attentionMarkOf';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { useFleetPhrase } from '../../../../features/workspace/hooks/useFleetPhrase';

type SelectParams = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type HoverParams = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

type Props = {
  readonly session: Session;
  readonly onSelect: (params: SelectParams) => void;
  readonly onHoverEnter: (params: HoverParams) => void;
  readonly onHoverLeave: () => void;
  readonly fallbackTone?: Tone;
};

export const NeedsYouSessionRow = ({
  session,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  fallbackTone = 'neutral',
}: Props) => {
  const info = useSessionStageInfo(session);
  const { attention } = info;
  const meta = attention === null ? null : ATTENTION_REASON_META[attention];
  const words =
    attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info });
  const tone = meta?.tone ?? fallbackTone;
  const mark: StatusMarkSpec =
    attention === null ? { kind: 'dot', tone } : attentionMarkOf({ reason: attention });
  const sessionId = session.id as SessionId;
  const phrase = useFleetPhrase({ sessionId });

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId, reason: attention })}
        onMouseEnter={(event) => onHoverEnter({ sessionId, anchor: event.currentTarget })}
        onMouseLeave={onHoverLeave}
        onFocus={(event) => {
          if (!isKeyboardFocus({ target: event.currentTarget })) {
            return;
          }
          onHoverEnter({ sessionId, anchor: event.currentTarget });
        }}
        onBlur={onHoverLeave}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-3 text-left transition-colors',
          ROW_INTERACTIVE,
        )}
      >
        <span data-attention-tone={tone} className="inline-flex shrink-0">
          <StatusMark mark={mark} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <InlineMarkdown
            text={sessionTitle({ session })}
            className="truncate text-control text-foreground"
          />
          <span
            data-fleet-phrase={phrase === null ? undefined : ''}
            className="truncate text-meta text-muted-foreground"
          >
            {phrase ?? words}
          </span>
        </span>
      </button>
    </li>
  );
};
