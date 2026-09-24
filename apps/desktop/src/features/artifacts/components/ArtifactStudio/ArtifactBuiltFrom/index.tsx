import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Collapsible, SectionSurface, Eyebrow, Skeleton } from '@goodboy/ui';
import type { ArtifactKind, ArtifactProvenance, SessionArtifact } from '@goodboy/types';
import { loadArtifactProvenance } from '../../../artifactProvenance';
import { BuiltFromRow } from './BuiltFromRow';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly artifact: SessionArtifact;
};

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'failed' }>
  | Readonly<{ kind: 'ready'; provenance: ArtifactProvenance }>;

const EVIDENCE_PREVIEW = 5;

type ScopeParams = {
  readonly kind: ArtifactKind;
  readonly sourceWorkflowRunId: string | null;
};

const scopeLine = ({ kind, sourceWorkflowRunId }: ScopeParams): string => {
  if (sourceWorkflowRunId === null) {
    return 'The whole session';
  }
  if (kind === 'wireframe') {
    return `Workflow run ${sourceWorkflowRunId}. Agents were scoped to that run, session plans were not`;
  }
  return `Workflow run ${sourceWorkflowRunId}. Agents and artifacts were scoped to that run, session events, checks and local change evidence were not`;
};

export const ArtifactBuiltFrom = ({ artifact }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setState({ kind: 'loading' });
    loadArtifactProvenance(artifact.agentId)
      .then((provenance) => {
        if (!isCurrent) {
          return;
        }
        setState(provenance === null ? { kind: 'missing' } : { kind: 'ready', provenance });
      })
      .catch(() => {
        if (isCurrent) {
          setState({ kind: 'failed' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [artifact.agentId, loadAttempt]);

  if (state.kind === 'loading') {
    return (
      <SectionSurface label="Built from" ariaLabel="Built from">
        <div role="status" aria-label="Loading built from" className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3 rounded-sm" />
          <Skeleton className="h-3 w-1/2 rounded-sm" />
        </div>
      </SectionSurface>
    );
  }

  if (state.kind === 'failed') {
    return (
      <SectionSurface label="Built from" ariaLabel="Built from">
        <div data-testid="built-from-failed" className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            The record of this generation did not load.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setLoadAttempt((n) => n + 1)}>
            <RotateCcw size={ICON_SIZE.row} aria-hidden />
            Retry
          </Button>
        </div>
      </SectionSurface>
    );
  }

  if (state.kind === 'missing') {
    return (
      <SectionSurface label="Built from" ariaLabel="Built from">
        <p data-testid="built-from-missing" className="text-xs text-muted-foreground">
          nothing was recorded for this generation. artifacts made before goodboy started keeping
          the request and the evidence behind them carry no record of either.
        </p>
      </SectionSurface>
    );
  }

  const { provenance } = state;
  const evidence =
    isEvidenceOpen || provenance.evidence.length <= EVIDENCE_PREVIEW
      ? provenance.evidence
      : provenance.evidence.slice(0, EVIDENCE_PREVIEW);

  return (
    <SectionSurface label="Built from" ariaLabel="Built from">
      <div data-testid="built-from" className="flex min-w-0 flex-col gap-3">
        <BuiltFromRow label="Brief">{provenance.brief ?? 'No brief was given'}</BuiltFromRow>
        <BuiltFromRow label="Based on">
          {scopeLine({
            kind: provenance.kind,
            sourceWorkflowRunId: provenance.sourceWorkflowRunId,
          })}
        </BuiltFromRow>
        <BuiltFromRow label="Ran in">
          {provenance.executingWorkflowRunId === null
            ? 'No workflow step, this agent ran on its own'
            : `Workflow run ${provenance.executingWorkflowRunId}`}
        </BuiltFromRow>
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow label="Evidence sent" />
          {provenance.evidence.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              no session source was named in the pack
            </span>
          ) : (
            <ul className="flex min-w-0 flex-col gap-0.5">
              {evidence.map((entry) => (
                <li
                  key={`${entry.kind}-${entry.id}`}
                  data-testid="built-from-evidence"
                  className="flex min-w-0 items-baseline gap-2 text-xs"
                >
                  <Eyebrow label={entry.kind} className="shrink-0" />
                  <span className="min-w-0 truncate text-foreground">{entry.label}</span>
                </li>
              ))}
            </ul>
          )}
          {provenance.evidence.length > EVIDENCE_PREVIEW && !isEvidenceOpen ? (
            <button
              type="button"
              data-testid="built-from-evidence-more"
              className="self-start text-2xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsEvidenceOpen(true)}
            >
              show all {provenance.evidence.length}
            </button>
          ) : null}
        </div>
        <BuiltFromRow label="Left out or truncated">
          {provenance.omissions.length === 0
            ? 'Nothing was dropped from the pack'
            : provenance.omissions.join('\n')}
        </BuiltFromRow>
        {provenance.designProfileSummary === null ? null : (
          <Collapsible
            open={isProfileOpen}
            onOpenChange={setIsProfileOpen}
            trigger={<span className="text-xs">design profile</span>}
          >
            <pre
              data-testid="built-from-design-profile"
              className="min-w-0 whitespace-pre-wrap break-words text-2xs text-muted-foreground"
            >
              {provenance.designProfileSummary}
            </pre>
          </Collapsible>
        )}
      </div>
    </SectionSurface>
  );
};
