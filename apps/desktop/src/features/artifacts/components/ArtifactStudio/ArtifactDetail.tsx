import { ArrowLeft } from 'lucide-react';
import {
  Button,
  Divider,
  HeaderBand,
  Markdown,
  MetaRow,
  PANE_RHYTHM,
  ScrollFade,
  cn,
} from '@goodboy/ui';
import type { Agent, SessionArtifact, SessionId } from '@goodboy/types';
import { ArtifactExportActions } from './ArtifactExportActions';
import { ArtifactStatusChip } from './ArtifactStatusChip';
import { ReportStudio } from '../../../reports/components/ReportStudio';
import { FocusedPane } from '../../../../shared/components/PaneShell/FocusedPane';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly count: number;
  readonly onBack: () => void;
};

const prettyJson = (source: string): string => {
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
};

export const ArtifactDetail = ({
  sessionId,
  artifact,
  agents,
  artifacts,
  count,
  onBack,
}: Props) => {
  const creator = agents.find((agent) => agent.id === artifact.agentId);

  return (
    <FocusedPane
      lens="Artifacts"
      count={count}
      actions={
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={ICON_SIZE.row} aria-hidden />
          All artifacts
        </Button>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={cn('flex shrink-0 flex-col gap-2', PANE_RHYTHM.body)}>
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
            <HeaderBand
              title={artifact.title}
              meta={<ArtifactStatusChip kind={artifact.kind} status={artifact.status} />}
              subtitle={
                <MetaRow
                  items={[
                    <span key="agent" className="inline-flex min-w-0 items-center gap-1.5">
                      <CONCEPT_ICONS.agents
                        size={11}
                        aria-hidden
                        className="shrink-0 text-primary"
                      />
                      <span className="truncate">{creator?.name ?? 'unknown agent'}</span>
                    </span>,
                    <span key="kind">{artifact.kind}</span>,
                    artifact.workflowRunId !== null ? (
                      <span key="run">workflow run</span>
                    ) : (
                      <span key="run">standalone</span>
                    ),
                    <span key="revision">rev {artifact.revision}</span>,
                    <span key="created" className="tabular-nums">
                      {formatCompactDateTime({ iso: artifact.createdAt })}
                    </span>,
                  ]}
                />
              }
              actions={<ArtifactExportActions artifact={artifact} />}
            />
          </div>
        </div>
        <Divider />
        <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
            {artifact.kind === 'report' ? (
              <ReportStudio
                sessionId={sessionId}
                artifact={artifact}
                agents={agents}
                artifacts={artifacts}
              />
            ) : null}
            {artifact.kind !== 'report' && artifact.sourceFormat === 'markdown' ? (
              <Markdown text={artifact.sourceText} className="text-xs" />
            ) : null}
            {artifact.sourceFormat === 'json' ? (
              <pre
                data-testid="artifact-json-source"
                className="overflow-x-auto rounded-md border border-border-soft bg-elevated p-3 font-mono text-2xs text-foreground/80"
              >
                {prettyJson(artifact.sourceText)}
              </pre>
            ) : null}
          </div>
        </ScrollFade>
      </div>
    </FocusedPane>
  );
};
