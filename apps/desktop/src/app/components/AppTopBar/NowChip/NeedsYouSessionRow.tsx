import { cn, tintClasses, InlineMarkdown, inlineMarkdownText, type Tone } from '@goodboy/ui';
import type { Session, SessionAttentionReason, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../../store';
import {
  ATTENTION_REASON_META,
  attentionWordsOf,
} from '../../../../features/session/session-stage';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly onSelect: (params: SelectParams) => void;
  readonly fallbackTone?: Tone;
};

type SelectParams = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

export const NeedsYouSessionRow = ({ session, onSelect, fallbackTone = 'neutral' }: Props) => {
  const info = useSessionStageInfo(session);
  const { attention } = info;
  const meta = attention === null ? null : ATTENTION_REASON_META[attention];
  const words =
    attention === null ? info.reason : attentionWordsOf({ reason: attention, counts: info });
  const tone = meta?.tone ?? fallbackTone;
  const Icon = CONCEPT_ICONS[meta?.icon ?? 'sessions'];

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId: session.id as SessionId, reason: attention })}
        title={`${inlineMarkdownText({ text: session.goal })} · ${words}`}
        className="flex w-full items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-hover"
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
