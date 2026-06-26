import { useState } from 'react';
import type { IsoDateTime, Session } from '@goodboy/types';
import { insertNudgeEvent, updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../../../shared/lib/db';
import type { AgentKind } from '../../../../session/agent-kind';
import { detectScopeMismatch, type ScopeMismatch } from '../../../utils/scope-mismatch';
import type { PendingAttachment } from '../lib';

export type ScopePending = {
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly mismatch: ScopeMismatch;
};

type UseScopeNudgeArgs = {
  readonly session: Session;
  readonly activeAgentKind: AgentKind | null;
  readonly isRunning: boolean;
};

export function useScopeNudge({ session, activeAgentKind, isRunning }: UseScopeNudgeArgs) {
  const [scopePending, setScopePending] = useState<ScopePending | null>(null);
  const [scopeNudgeEventId, setScopeNudgeEventId] = useState<string | null>(null);

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) return;
    try {
      await updateNudgeEventOutcome(
        tauriDatabase,
        scopeNudgeEventId,
        outcome,
        new Date().toISOString() as IsoDateTime,
      );
    } catch {
      // best-effort
    }
    setScopeNudgeEventId(null);
  };

  const checkAndInterceptScope = async (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
  ): Promise<boolean> => {
    if (
      isRunning ||
      scopePending !== null ||
      activeAgentKind === null ||
      session.workflowRuns.length > 0
    ) {
      return false;
    }
    const mismatch = detectScopeMismatch(content, activeAgentKind);
    if (!mismatch) return false;

    const id = crypto.randomUUID();
    try {
      await insertNudgeEvent(tauriDatabase, {
        id,
        ts: new Date().toISOString() as IsoDateTime,
        kind: 'scope-mismatch',
        contextJson: JSON.stringify({
          sessionId: session.id,
          agentKind: activeAgentKind,
          mismatchKind: mismatch.kind,
          suggested: mismatch.suggestedAgentKind,
        }),
        outcome: null,
        outcomeTs: null,
      });
    } catch {
      // telemetry is best-effort
    }
    setScopeNudgeEventId(id);
    setScopePending({ content, attachments: atts, mismatch });
    return true;
  };

  return {
    scopePending,
    setScopePending,
    scopeNudgeEventId,
    setScopeNudgeEventId,
    recordScopeOutcome,
    checkAndInterceptScope,
  };
}
