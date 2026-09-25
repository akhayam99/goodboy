import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { ReportArtifact } from '@goodboy/types';
import { buildReportOutline } from '../../reportOutline';
import { dropLeadingTitleHeading } from '../ArtifactReaderView/dropLeadingTitleHeading';
import { ArtifactProse } from '../../../artifacts/components/ArtifactProse';
import { ReportContentsMenu } from './ReportContentsMenu';
import { ReportOutlineNav } from './ReportOutlineNav';
import { useOutlinePlacement } from './useOutlinePlacement';

type Props = {
  readonly artifact: ReportArtifact;
};

export const ReportStudio = ({ artifact }: Props) => {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const isOutlineAside = useOutlinePlacement({ containerRef: layoutRef }) === 'aside';
  const text = useMemo(
    () => dropLeadingTitleHeading({ sourceText: artifact.sourceText, title: artifact.title }),
    [artifact.sourceText, artifact.title],
  );
  const outline = useMemo(() => buildReportOutline({ markdown: text }), [text]);

  useEffect(() => {
    setActiveHeadingId(null);
  }, [artifact.id, artifact.sourceText]);

  const scrollToHeading = (id: string) => {
    setActiveHeadingId(id);
    const position = outline.findIndex((candidate) => candidate.id === id);
    if (position < 0 || bodyRef.current === null) {
      return;
    }
    const heading = bodyRef.current.querySelectorAll('h1, h2, h3').item(position);
    heading?.scrollIntoView({ block: 'start' });
  };

  const hasOutline = outline.length > 0;

  return (
    <div
      ref={layoutRef}
      data-testid="report-studio"
      className={cn('flex min-w-0', hasOutline && isOutlineAside ? 'gap-10' : 'flex-col gap-3')}
    >
      {hasOutline && isOutlineAside ? (
        <aside
          data-testid="report-outline-rail"
          className="sticky top-0 flex max-h-[60vh] w-45 shrink-0 flex-col self-start overflow-y-auto"
        >
          <ReportOutlineNav
            entries={outline}
            activeId={activeHeadingId}
            showHeader
            onSelect={scrollToHeading}
          />
        </aside>
      ) : null}
      {hasOutline && !isOutlineAside ? (
        <ReportContentsMenu
          entries={outline}
          activeId={activeHeadingId}
          onSelect={scrollToHeading}
        />
      ) : null}
      <div ref={bodyRef} className="min-w-0 flex-1">
        <ArtifactProse text={text} />
      </div>
    </div>
  );
};
