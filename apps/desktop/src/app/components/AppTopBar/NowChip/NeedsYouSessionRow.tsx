import { cn, tintClasses, InlineMarkdown, inlineMarkdownText, type Tone } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../../store';
import { ATTENTION_REASON_META } from '../../../../features/session/session-stage';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly onSelect: (params: SelectParams) => void;
  readonly fallbackTone?: Tone;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

export const NeedsYouSessionRow = ({ session, onSelect, fallbackTone = 'neutral' }: Props) => {
  const { reason, attention } = useSessionStageInfo(session);
  const meta = attention == null ? null : ATTENTION_REASON_META[attention];
  const Icon = CONCEPT_ICONS[meta?.icon ?? 'sessions'];

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId: session.id as SessionId })}
        title={`${inlineMarkdownText({ text: session.goal })} · ${reason}`}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-hover"
      >
        <Icon
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('mt-px shrink-0', tintClasses(meta?.tone ?? fallbackTone).icon)}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <InlineMarkdown
            text={session.goal}
            className="truncate text-label font-medium text-foreground"
          />
          <span className="truncate text-secondary text-muted-foreground">{reason}</span>
        </span>
      </button>
    </li>
  );
};
