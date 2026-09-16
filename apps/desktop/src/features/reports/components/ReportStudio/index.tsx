import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Eye, Pencil, RotateCcw } from 'lucide-react';
import { Button, Divider, Markdown, SegmentedTabs, Textarea, cn, formatError } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ReportArtifact,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { buildReportOutline } from '../../reportOutline';
import { collectReportSourceLinks } from '../../reportSourceLinks';
import { asReportType, REPORT_TYPE_LABEL } from '../../reportTypes';
import { ReportOutlineNav } from './ReportOutlineNav';
import { ReportProvenanceRow } from './ReportProvenanceRow';
import { useOutlinePlacement } from './useOutlinePlacement';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: ReportArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
};

type Mode = 'preview' | 'edit';

const REGENERATE_READY_HINT = 'Run the report again on the same evidence pack';

const REGENERATE_BLOCKED_HINT =
  'the evidence pack this report was built from is no longer in memory, so regenerating would build a different report';

export const ReportStudio = ({
  sessionId,
  artifact,
  agents,
  artifacts,
  onSelectArtifact,
}: Props) => {
  const [mode, setMode] = useState<Mode>('preview');
  const [draft, setDraft] = useState(artifact.sourceText);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const isOutlineInline = useOutlinePlacement({ containerRef: layoutRef }) === 'inline';
  const updateArtifactSource = useAppStore((state) => state.updateArtifactSource);
  const spawnReportAgent = useAppStore((state) => state.spawnReportAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const kickoff = useAppStore((state) => {
    const events = state.transcripts?.[artifact.agentId] ?? [];
    const first = events.find((event) => event.kind === 'user_text');
    return first?.kind === 'user_text' ? first.text : null;
  });
  const outline = useMemo(
    () => buildReportOutline({ markdown: artifact.sourceText }),
    [artifact.sourceText],
  );
  const links = useMemo(
    () =>
      collectReportSourceLinks({
        sourceText: artifact.sourceText,
        agents,
        artifacts,
        excludeArtifactId: artifact.id,
      }),
    [agents, artifacts, artifact.id, artifact.sourceText],
  );
  const reportType = asReportType({ value: artifact.metadata.reportType });
  const typeLabel =
    reportType === null ? artifact.metadata.reportType : REPORT_TYPE_LABEL[reportType];
  const canRegenerate = kickoff !== null && kickoff.trim().length > 0;

  useEffect(() => {
    setMode('preview');
    setDraft(artifact.sourceText);
    setError(null);
    setActiveHeadingId(null);
    setIsOutlineOpen(false);
  }, [artifact.id, artifact.sourceText]);

  const commitEdit = async () => {
    if (draft === artifact.sourceText) {
      return;
    }
    setError(null);
    try {
      await updateArtifactSource({
        sessionId,
        artifactId: artifact.id,
        title: artifact.title,
        sourceFormat: 'markdown',
        sourceText: draft,
        metadata: artifact.metadata,
      });
    } catch (cause) {
      setError(formatError(cause));
    }
  };

  const regenerate = async () => {
    if (isRegenerating || !canRegenerate) {
      return;
    }
    setIsRegenerating(true);
    setError(null);
    try {
      await spawnReportAgent({
        sessionId,
        reportType: reportType ?? 'session-summary',
        workflowRunId: artifact.workflowRunId,
        attachments: [],
        evidence: kickoff,
      });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setIsRegenerating(false);
    }
  };

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
      <ReportProvenanceRow
        reportType={typeLabel}
        links={links}
        onOpenAgent={(agentId: AgentId) => void selectAgent(sessionId, agentId)}
        onOpenArtifact={(artifactId: ArtifactId) => onSelectArtifact(artifactId)}
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SegmentedTabs
          ariaLabel="Report mode"
          size="sm"
          options={[
            { value: 'preview', label: 'Preview', icon: Eye },
            { value: 'edit', label: 'Edit', icon: Pencil },
          ]}
          value={mode}
          onChange={(next) => {
            if (next === 'preview' && mode === 'edit') {
              void commitEdit();
            }
            setMode(next);
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void regenerate()}
          disabled={isRegenerating || !canRegenerate}
          data-testid="report-regenerate"
          title={canRegenerate ? REGENERATE_READY_HINT : REGENERATE_BLOCKED_HINT}
        >
          <RotateCcw size={11} aria-hidden />
          {isRegenerating ? 'Starting' : 'Regenerate'}
        </Button>
        {canRegenerate ? null : (
          <span data-testid="report-regenerate-blocked" className="text-2xs text-muted-foreground">
            {REGENERATE_BLOCKED_HINT}
          </span>
        )}
      </div>
      {error === null ? null : (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
      <Divider />
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
