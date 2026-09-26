import { useState } from 'react';
import type { IsoDateTime, Session } from '@goodboy/types';
import { insertNudgeEvent, updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { tauriDatabase } from '../../../../../shared/lib/db';
import type { AgentKind } from '../../../../session/agent-kind';
import { hasActiveWorkflowRun } from '../../../../workflows/activeWorkflowRuns';
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

export const useScopeNudge = ({ session, activeAgentKind, isRunning }: UseScopeNudgeArgs) => {
  const [scopePending, setScopePending] = useState<ScopePending | null>(null);
  const [scopeNudgeEventId, setScopeNudgeEventId] = useState<string | null>(null);
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) return;
    try {
      await updateNudgeEventOutcome(
        tauriDatabase,
        scopeNudgeEventId,
        outcome,
        new Date().toISOString() as IsoDateTime,
      );
    } catch {}
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
      hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents: sessionAgents })
    ) {
      return false;
    }
    const mismatch = detectScopeMismatch({ input: content, agentKind: activeAgentKind });
    if (!mismatch) return false;

    const id = crypto.randomUUID();
    try {
      await insertNudgeEvent(tauriDatabase, {
        id,
        sessionId: session.id,
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
    } catch {}
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
};
