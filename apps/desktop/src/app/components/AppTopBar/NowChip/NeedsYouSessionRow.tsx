import { ROW_INTERACTIVE, cn, tintClasses, InlineMarkdown, type Tone } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../../store';
import {
  ATTENTION_REASON_META,
  attentionWordsOf,
} from '../../../../features/session/session-stage';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const Icon = CONCEPT_ICONS[meta?.icon ?? 'sessions'];
  const sessionId = session.id as SessionId;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId, reason: attention })}
        onMouseEnter={(event) => onHoverEnter({ sessionId, anchor: event.currentTarget })}
        onMouseLeave={onHoverLeave}
        onFocus={(event) => onHoverEnter({ sessionId, anchor: event.currentTarget })}
        onBlur={onHoverLeave}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-3 text-left transition-colors',
          ROW_INTERACTIVE,
        )}
      >
        <Icon
          size={ICON_SIZE.control}
          aria-hidden
          data-attention-tone={tone}
          className={cn('mt-px shrink-0', tintClasses(tone).icon)}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <InlineMarkdown
            text={session.goal}
            className="truncate text-label font-medium text-foreground"
          />
          <span className="truncate text-meta text-muted-foreground">{words}</span>
        </span>
      </button>
    </li>
  );
};
