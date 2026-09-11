import { useMemo } from 'react';
import { Button, cn, tintClasses } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionStageInfo } from '../../../../store';
import type { LensKind } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { describeSessionStage } from '../../session-stage';
import { agentHomeLens, classifyAgent, resolveRootAgent } from '../../agent-kind';
import { attentionAgentId, resolveAttentionTarget } from './lib';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const AttentionCallout = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id as SessionId;
  const stage = useSessionStageInfo(session);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setActiveLens = useAppStore((s) => s.setActiveLens);

  const target = useMemo(() => {
    const agentId = attentionAgentId({ stage, agents });
    if (agentId === null) {
      return resolveAttentionTarget({ stage, agent: null });
    }
    const root = resolveRootAgent({ agents, agentId }) ?? null;
    const home =
      root === null
        ? 'agents'
        : agentHomeLens(root, classifyAgent(root, agentKindOverride[root.id] ?? null));
    return resolveAttentionTarget({ stage, agent: { agentId, home } });
  }, [agentKindOverride, agents, stage]);

  if (stage.stage !== 'attention' || target === null) {
    return null;
  }

  const presentation = describeSessionStage(stage);
  const tint = tintClasses(presentation.tone);
  const Icon = presentation.icon;

  const open = () => {
    if (target.kind === 'lens') {
      onSelectLens(target.lens);
      return;
    }
    setActiveLens(sessionId, target.home);
    void selectAgent(sessionId, target.agentId);
  };

  return (
    <section
      aria-label="Needs you"
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md border p-2.5',
        tint.borderSoft,
        tint.bg,
      )}
    >
      <Icon size={ICON_SIZE.control} aria-hidden className={cn('shrink-0', tint.icon)} />
      <p className="min-w-0 flex-1 text-xs text-foreground">
        <span className="font-medium">Needs you</span>
        <span className="text-muted-foreground">{`: ${presentation.reason}`}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={open}>
        {target.label}
      </Button>
    </section>
  );
};
