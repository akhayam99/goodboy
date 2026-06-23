import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PlanId, SessionId } from '@goodboy/types';
import { extractHandoff } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { AGENT_KIND_META } from '../../../session/agent-kind';

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
    if (isActiveNudge) {
      void acceptHandoff(sessionId);
      return;
    }
    void spawnAgent(sessionId, {
      kindOverride: handoff.kind,
      ...(handoff.planId ? { triggeredPlanId: handoff.planId as PlanId } : {}),
    });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="handoff-chip"
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info hover:bg-info/20"
    >
      <ArrowRight size={11} aria-hidden />
      <span>spawn {meta.label.toLowerCase()}</span>
      {handoff.reason ? <span className="text-muted-foreground">· {handoff.reason}</span> : null}
    </button>
  );
};
