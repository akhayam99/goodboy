import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PlanId, SessionId } from '@goodboy/types';
import { extractHandoff } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { AGENT_KIND_META } from '../../../session/agent-kind';
import { TranscriptShell } from '../TranscriptShell';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import { tintClasses } from '@goodboy/ui';

const accent = tintClasses('neutral');

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

export const HandoffChip = ({ assistantText, sessionId }: Props) => {
  const handoff = useMemo(() => extractHandoff(assistantText), [assistantText]);
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const sessionNudge = useAppStore((s) => s.sessionNudges[sessionId] ?? null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const acceptHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const announceAgentStarted = useAgentStartedToast();

  if (!handoff || !session) {
    return null;
  }
  if (session.workflowRuns.length > 0) {
    return null;
  }

  const meta = AGENT_KIND_META[handoff.kind];
  const isActiveNudge =
    sessionNudge?.kind === 'handoff-suggested' && sessionNudge.targetKind === handoff.kind;

  const onClick = () => {
    void (async () => {
      const agentId = isActiveNudge
        ? await acceptHandoff(sessionId)
        : await spawnAgent(sessionId, {
            kindOverride: handoff.kind,
            ...(handoff.planId ? { triggeredPlanId: handoff.planId as PlanId } : {}),
            focus: 'none',
          });
      announceAgentStarted({
        sessionId,
        agentId,
        title: `${meta.label} started`,
        message: 'The agent is picking this up. You can keep working.',
      });
    })();
  };
  return (
    <TranscriptShell
      as="button"
      type="button"
      onClick={onClick}
      data-testid="handoff-chip"
      tone="neutral"
      variant="pill"
      className={`inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${accent.text}`}
    >
      <ArrowRight size={12} aria-hidden />
      <span>spawn {meta.label.toLowerCase()}</span>
      {handoff.reason ? <span className="text-muted-foreground">· {handoff.reason}</span> : null}
    </TranscriptShell>
  );
};
