import { useMemo, useRef, useState } from 'react';
import { Eye, Pencil, RotateCcw } from 'lucide-react';
import { Button, Divider, Markdown, SegmentedTabs, Textarea, cn, formatError } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ReportArtifact,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { buildReportOutline } from '../../reportOutline';
import { collectReportSourceLinks } from '../../reportSourceLinks';
import { asReportType, REPORT_TYPE_LABEL } from '../../reportTypes';
import { ReportOutlineNav } from './ReportOutlineNav';
import { ReportProvenanceRow } from './ReportProvenanceRow';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: ReportArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
};

type Mode = 'preview' | 'edit';

export const ReportStudio = ({ sessionId, artifact, agents, artifacts }: Props) => {
  const [mode, setMode] = useState<Mode>('preview');
  const [draft, setDraft] = useState(artifact.sourceText);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const updateArtifactSource = useAppStore((state) => state.updateArtifactSource);
  const spawnReportAgent = useAppStore((state) => state.spawnReportAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const setFocusedPlanId = useAppStore((state) => state.setFocusedPlanId);
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
    if (isRegenerating) {
      return;
    }
    setIsRegenerating(true);
    setError(null);
    try {
      await spawnReportAgent({
        sessionId,
        reportType: reportType ?? 'session-summary',
        workflowRunId: artifact.workflowRunId,
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
    const entry = outline.find((candidate) => candidate.id === id);
    if (entry === undefined || bodyRef.current === null) {
      return;
    }
    const headings = bodyRef.current.querySelectorAll('h1, h2, h3');
    const match = [...headings].find((node) => node.textContent?.trim() === entry.title.trim());
    match?.scrollIntoView({ block: 'start' });
  };

  return (
    <div data-testid="report-studio" className="flex min-w-0 flex-col gap-3">
      <ReportProvenanceRow
        reportType={typeLabel}
        links={links}
        onOpenAgent={(agentId: AgentId) => void selectAgent(sessionId, agentId)}
        onOpenArtifact={(artifactId: ArtifactId) => setFocusedPlanId(sessionId, artifactId)}
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
          disabled={isRegenerating}
          data-testid="report-regenerate"
          title="Run the report again on the same evidence pack"
        >
          <RotateCcw size={11} aria-hidden />
          {isRegenerating ? 'Starting' : 'Regenerate'}
        </Button>
      </div>
      {error === null ? null : (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
      <Divider />
      <div className={cn('flex min-w-0 gap-4', outline.length === 0 && 'gap-0')}>
        {outline.length === 0 ? null : (
          <aside className="hidden w-48 shrink-0 lg:block">
            <ReportOutlineNav
              entries={outline}
              activeId={activeHeadingId}
              onSelect={scrollToHeading}
            />
          </aside>
        )}
        <div ref={bodyRef} className="min-w-0 flex-1">
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
  );
};
