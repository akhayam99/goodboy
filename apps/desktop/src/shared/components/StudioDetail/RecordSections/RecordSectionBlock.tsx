import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Eyebrow, FOCUS_RING, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../conceptIcons';
import type { RecordSection } from './types';

type Props = {
  readonly section: RecordSection;
};

export const RecordSectionBlock = ({ section }: Props) => {
  const [isOpen, setIsOpen] = useState(section.defaultOpen || !section.isCollapsible);
  const panelId = useId();
  const count =
    section.count == null ? null : (
      <span className="text-meta text-faint-foreground">{section.count}</span>
    );

  if (!section.isCollapsible) {
    return (
      <section
        aria-label={section.label}
        data-record-section={section.key}
        className="flex min-w-0 flex-col gap-2"
      >
        {section.kind === 'description' ? null : (
          <div className="flex items-baseline gap-1.5">
            <Eyebrow label={section.label} />
            {count}
          </div>
        )}
        {section.content}
      </section>
    );
  }

  return (
    <section
      aria-label={section.label}
      data-record-section={section.key}
      className="flex min-w-0 flex-col gap-1"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left hover:bg-hover',
          FOCUS_RING,
        )}
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform',
            isOpen && 'rotate-90',
          )}
        />
        <span className="shrink-0 text-secondary font-semibold text-foreground">
          {section.label}
        </span>
        {section.summary == null ? null : (
          <span className="min-w-0 truncate text-secondary text-muted-foreground">
            {section.summary}
          </span>
        )}
        {count}
      </button>
      {isOpen ? (
        <div id={panelId} className="min-w-0 px-2">
          {section.content}
        </div>
      ) : null}
    </section>
  );
};
