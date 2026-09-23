import { useEffect, useState } from 'react';
import { Collapsible, SectionSurface, Eyebrow } from '@goodboy/ui';
import type { ArtifactKind, ArtifactProvenance, SessionArtifact } from '@goodboy/types';
import { loadArtifactProvenance } from '../../../artifactProvenance';
import { BuiltFromRow } from './BuiltFromRow';

type Props = {
  readonly artifact: SessionArtifact;
};

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'ready'; provenance: ArtifactProvenance }>;

const EVIDENCE_PREVIEW = 5;

type ScopeParams = {
  readonly kind: ArtifactKind;
  readonly sourceWorkflowRunId: string | null;
};

const scopeLine = ({ kind, sourceWorkflowRunId }: ScopeParams): string => {
  if (sourceWorkflowRunId === null) {
    return 'the whole session';
  }
  if (kind === 'wireframe') {
    return `workflow run ${sourceWorkflowRunId}. agents were scoped to that run, session plans were not`;
  }
  return `workflow run ${sourceWorkflowRunId}. agents and artifacts were scoped to that run, session events, checks and local change evidence were not`;
};

export const ArtifactBuiltFrom = ({ artifact }: Props) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
          setState({ kind: 'missing' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [artifact.agentId]);

  if (state.kind === 'loading') {
    return null;
  }

  if (state.kind === 'missing') {
    return (
      <SectionSurface label="built from" ariaLabel="built from">
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
    <SectionSurface label="built from" ariaLabel="built from">
      <div data-testid="built-from" className="flex min-w-0 flex-col gap-3">
        <BuiltFromRow label="brief">{provenance.brief ?? 'no brief was given'}</BuiltFromRow>
        <BuiltFromRow label="based on">
          {scopeLine({
            kind: provenance.kind,
            sourceWorkflowRunId: provenance.sourceWorkflowRunId,
          })}
        </BuiltFromRow>
        <BuiltFromRow label="ran in">
          {provenance.executingWorkflowRunId === null
            ? 'no workflow step, this agent ran on its own'
            : `workflow run ${provenance.executingWorkflowRunId}`}
        </BuiltFromRow>
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow label="evidence sent" />
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
        <BuiltFromRow label="left out or truncated">
          {provenance.omissions.length === 0
            ? 'nothing was dropped from the pack'
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
