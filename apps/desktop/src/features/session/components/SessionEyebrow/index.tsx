import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { InlineMarkdown } from '../../../../shared/components/InlineMarkdown';
import { stripInlineMarkdown } from '../../../../shared/components/InlineMarkdown/stripInlineMarkdown';

type Props = {
  readonly session: Session;
};

export const SessionEyebrow = ({ session }: Props) => {
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const sessionId = session.id as SessionId;
  const goal = session.goal === '' ? 'Untitled session' : session.goal;
  const title = stripInlineMarkdown({ text: goal });
  const Icon = CONCEPT_ICONS.sessions;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => setActiveLens(sessionId, null)}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 self-start text-2xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 truncate">
        <InlineMarkdown text={goal} />
      </span>
    </button>
  );
};
