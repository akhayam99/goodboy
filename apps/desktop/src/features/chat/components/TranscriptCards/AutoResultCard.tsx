import { parseAutoDelegationRole, stripOutcomeLine } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { Button, ClampedProse, TruncatedText } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { AutoArtifactRow } from '../../../auto/chat/AutoArtifactRow';
import type { ArtifactLinkModel } from '../../../auto/chat/artifactLinksOf';
import { isAwaitingApproval } from '../../../auto/chat/isAwaitingApproval';
import { settledStatusOf } from '../../../auto/chat/settledStatusOf';
import { summaryNotesOf } from '../../../auto/chat/summaryNotesOf';
import { summaryProseOf } from '../../../auto/chat/summaryProseOf';
import { kindForRole, type AgentKind } from '../../../session/agent-kind';
import { OutcomeLine } from '../../readingOrder/OutcomeLine';
import { ReadingNotes } from '../../readingOrder/ReadingNotes';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly result: AutoDeliveredResult;
  readonly label: string;
  readonly artifacts: ReadonlyArray<ArtifactLinkModel>;
  readonly onOpenChild: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: string) => void;
};

const SUMMARY_LINES = 3;

export const AutoResultCard = ({
  result,
  label,
  artifacts,
  onOpenChild,
  onOpenArtifact,
}: Props) => {
  const role = parseAutoDelegationRole({ role: result.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  const status = settledStatusOf({ outcome: result.outcome });
  const body =
    result.outcome === 'completed' || result.outcome === 'blocked' ? result.summary : null;
  const rows = artifacts.filter((link) => !isAwaitingApproval({ link }));
  const hasArtifacts = result.artifacts.length > 0;
  const { outcomeLine } = result;
  const notes = hasArtifacts
    ? summaryNotesOf({ summary: body, key: result.delegationId, isOpen: false })
    : null;
  const preview = hasArtifacts
    ? null
    : summaryProseOf({ summary: body === null ? null : stripOutcomeLine({ text: body }) });
  return (
    <TranscriptShell tone={status.tone} variant="plain" data-testid="auto-result-card">
      <article
        aria-label={`${label}, ${status.word}`}
        data-auto-result={result.delegationId}
        data-outcome={result.outcome}
        className="flex min-w-0 flex-col gap-1"
      >
        <div className="flex h-7 min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AgentKindChip kind={kind} density="glyph" />
            <TruncatedText className="min-w-0 shrink truncate text-meta text-foreground">
              {label}
            </TruncatedText>
            <span className="min-w-0 shrink truncate">
              <RoutingLabel provider={result.provider} model={result.model} muted />
            </span>
          </div>
          <Button
            variant="quiet"
            size="xs"
            aria-label={`Open ${label}`}
            onClick={() => onOpenChild(result.childAgentId)}
          >
            Open
          </Button>
        </div>
        {outcomeLine === null ? null : (
          <OutcomeLine text={outcomeLine.text} tone={outcomeLine.tone} />
        )}
        {rows.length === 0 ? null : (
          <ul aria-label="Artifacts" className="flex min-w-0 flex-col gap-1">
            {rows.map((link) => (
              <li key={link.artifactId} className="min-w-0">
                <AutoArtifactRow link={link} onOpen={onOpenArtifact} />
              </li>
            ))}
          </ul>
        )}
        {notes === null ? null : <ReadingNotes role={notes} />}
        {preview === null ? null : <ClampedProse text={preview} lines={SUMMARY_LINES} />}
      </article>
    </TranscriptShell>
  );
};
