import { parseAutoDelegationRole } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { Button, ClampedProse, TruncatedText } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { settledStatusOf } from '../../../auto/chat/settledStatusOf';
import { kindForRole, type AgentKind } from '../../../session/agent-kind';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly result: AutoDeliveredResult;
  readonly label: string;
  readonly onOpenChild: (agentId: AgentId) => void;
};

const SUMMARY_LINES = 3;

export const AutoResultCard = ({ result, label, onOpenChild }: Props) => {
  const role = parseAutoDelegationRole({ role: result.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  const status = settledStatusOf({ outcome: result.outcome });
  const body =
    result.outcome === 'completed' || result.outcome === 'blocked' ? result.summary : null;
  return (
    <TranscriptShell tone={status.tone} variant="leftBorder" data-testid="auto-result-card">
      <article
        aria-label={`${label}, ${status.word}`}
        data-auto-result={result.delegationId}
        data-outcome={result.outcome}
        className="flex min-w-0 flex-col gap-1"
      >
        <div className="flex h-7 min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AgentKindChip kind={kind} density="glyph" />
            <TruncatedText className="min-w-0 shrink truncate text-label text-foreground">
              {label}
            </TruncatedText>
            <span className="min-w-0 shrink truncate">
              <RoutingLabel provider={result.provider} model={result.model} muted />
            </span>
            <span className="shrink-0 text-label text-muted-foreground">{status.word}</span>
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
        {body === null ? null : <ClampedProse text={body} lines={SUMMARY_LINES} />}
      </article>
    </TranscriptShell>
  );
};
