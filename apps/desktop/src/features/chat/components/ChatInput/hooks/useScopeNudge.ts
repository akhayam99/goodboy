import { useState } from 'react';
import type { Session } from '@goodboy/types';
import type { NudgeOutcome } from '@goodboy/db';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { AgentKind } from '../../../../session/agent-kind';
import { hasActiveWorkflowRun } from '../../../../workflows/activeWorkflowRuns';
import { detectScopeMismatch, type ScopeMismatch } from '../../../utils/scope-mismatch';
import type { PendingAttachment } from '../../../../attachments/pendingAttachment';

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
  const recordNudgeShown = useAppStore((s) => s.recordNudgeShown);
  const recordNudgeOutcome = useAppStore((s) => s.recordNudgeOutcome);

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) {
      return;
    }
    await recordNudgeOutcome({ id: scopeNudgeEventId, outcome });
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
    if (!mismatch) {
      return false;
    }

    const id = await recordNudgeShown({
      sessionId: session.id,
      kind: 'scope-mismatch',
      context: {
        sessionId: session.id,
        agentKind: activeAgentKind,
        mismatchKind: mismatch.kind,
        suggested: mismatch.suggestedAgentKind,
      },
    });
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
