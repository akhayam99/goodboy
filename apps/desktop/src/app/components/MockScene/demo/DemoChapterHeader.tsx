import { MousePointerClick } from 'lucide-react';
import { Eyebrow, ICON_SIZE } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';

type Props = {
  readonly chapter: DemoChapter;
  readonly position: string;
};

export const DemoChapterHeader = ({ chapter, position }: Props) => (
  <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-display text-foreground">{chapter.title}</h1>
        <Eyebrow label={position} muted />
      </div>
      <p className="text-ui text-muted-foreground">{chapter.summary}</p>
    </div>
    <p className="flex max-w-sm items-center gap-2 text-ui text-muted-foreground">
      <MousePointerClick size={ICON_SIZE.control} className="shrink-0 text-primary" aria-hidden />
      <span>
        <span className="text-foreground">Try this</span> {chapter.tryThis}
      </span>
    </p>
  </header>
);
