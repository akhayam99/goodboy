import { FOCUS_RING, cn } from '@goodboy/ui';
import type { GuideChapter } from '../guideChapters';

type Props = {
  readonly previous: GuideChapter | null;
  readonly next: GuideChapter | null;
  readonly onGo: (id: string) => void;
};

const CARD = cn(
  'flex min-w-0 flex-col gap-0.5 rounded-lg border border-border-soft px-3 py-2 motion-safe:transition-colors hover:bg-hover',
  FOCUS_RING,
);

export const ChapterPager = ({ previous, next, onGo }: Props) => (
  <nav aria-label="More chapters" className="grid grid-cols-2 gap-3">
    {previous === null ? (
      <span />
    ) : (
      <button
        type="button"
        onClick={() => onGo(previous.id)}
        aria-label={`Previous chapter, ${previous.title}`}
        className={cn(CARD, 'items-start text-left')}
      >
        <span className="text-ui text-faint-foreground">Previous</span>
        <span className="max-w-full truncate text-row text-foreground">{previous.title}</span>
      </button>
    )}
    {next === null ? (
      <span />
    ) : (
      <button
        type="button"
        onClick={() => onGo(next.id)}
        aria-label={`Next chapter, ${next.title}`}
        className={cn(CARD, 'items-end text-right')}
      >
        <span className="text-ui text-faint-foreground">Next</span>
        <span className="max-w-full truncate text-row text-foreground">{next.title}</span>
      </button>
    )}
  </nav>
);
