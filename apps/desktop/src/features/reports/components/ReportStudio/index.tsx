import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Markdown, Textarea, cn, formatError } from '@goodboy/ui';
import type { ReportArtifact, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { buildReportOutline } from '../../reportOutline';
import { ReportOutlineNav } from './ReportOutlineNav';
import type { ReportMode } from './ReportBandActions';
import { useOutlinePlacement } from './useOutlinePlacement';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: ReportArtifact;
  readonly mode: ReportMode;
};

export const ReportStudio = ({ sessionId, artifact, mode }: Props) => {
  const [draft, setDraft] = useState(artifact.sourceText);
  const [error, setError] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const previousModeRef = useRef(mode);
  const isOutlineInline = useOutlinePlacement({ containerRef: layoutRef }) === 'inline';
  const updateArtifactSource = useAppStore((state) => state.updateArtifactSource);
  const outline = useMemo(
    () => buildReportOutline({ markdown: artifact.sourceText }),
    [artifact.sourceText],
  );

  draftRef.current = draft;

  useEffect(() => {
    setDraft(artifact.sourceText);
    setError(null);
    setActiveHeadingId(null);
    setIsOutlineOpen(false);
  }, [artifact.id, artifact.sourceText]);

  useEffect(() => {
    const previous = previousModeRef.current;
    previousModeRef.current = mode;
    if (previous !== 'edit' || mode !== 'preview') {
      return;
    }
    const next = draftRef.current;
    if (next === artifact.sourceText) {
      return;
    }
    setError(null);
    updateArtifactSource({
      sessionId,
      artifactId: artifact.id,
      title: artifact.title,
      sourceFormat: 'markdown',
      sourceText: next,
      metadata: artifact.metadata,
    }).catch((cause: unknown) => {
      setError(formatError(cause));
    });
  }, [mode, sessionId, artifact, updateArtifactSource]);

  const scrollToHeading = (id: string) => {
    setActiveHeadingId(id);
    const position = outline.findIndex((candidate) => candidate.id === id);
    if (position < 0 || bodyRef.current === null) {
      return;
    }
    const heading = bodyRef.current.querySelectorAll('h1, h2, h3').item(position);
    heading?.scrollIntoView({ block: 'start' });
  };

  return (
    <div data-testid="report-studio" className="flex min-w-0 flex-col gap-3">
      {error === null ? null : (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
      <div
        ref={layoutRef}
        className={cn('flex min-w-0 gap-4', (outline.length === 0 || isOutlineInline) && 'gap-0')}
      >
        {outline.length === 0 || isOutlineInline ? null : (
          <aside
            data-testid="report-outline-rail"
            className="sticky top-0 flex max-h-[60vh] w-48 shrink-0 flex-col self-start overflow-y-auto"
          >
            <ReportOutlineNav
              entries={outline}
              activeId={activeHeadingId}
              showHeader
              onSelect={scrollToHeading}
            />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {outline.length === 0 || !isOutlineInline ? null : (
            <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-elevated p-2">
              <button
                type="button"
                aria-expanded={isOutlineOpen}
                data-testid="report-outline-toggle"
                className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground motion-safe:transition-colors hover:text-foreground"
                onClick={() => setIsOutlineOpen((previous) => !previous)}
              >
                <ChevronRight
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={cn('motion-safe:transition-transform', isOutlineOpen && 'rotate-90')}
                />
                Outline
                <span className="tabular-nums normal-case tracking-normal">{outline.length}</span>
              </button>
              {isOutlineOpen && (
                <ReportOutlineNav
                  entries={outline}
                  activeId={activeHeadingId}
                  showHeader={false}
                  onSelect={(id) => {
                    scrollToHeading(id);
                    setIsOutlineOpen(false);
                  }}
                />
              )}
            </div>
          )}
          <div ref={bodyRef} className="min-w-0">
            {mode === 'edit' ? (
              <Textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="w-full font-mono text-xs"
                autoGrow
                minRows={12}
                maxRows={80}
              />
            ) : (
              <Markdown text={artifact.sourceText} className="text-xs" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
