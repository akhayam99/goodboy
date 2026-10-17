import { useMemo } from 'react';
import { Button, DrawerFrame, EmptyState } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, agentPlace, useAppStore, useTranscript } from '../../store';
import { briefImagesOf } from '../../features/auto/child/briefImagesOf';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { TranscriptInsertion } from '../../shared/types/transcriptInsertion';
import { ChatView } from '../../features/chat/components/ChatView';
import { autoTreeOfAgent } from '../../features/auto/autoTreeOfAgent';
import { cardTitleOf } from '../../features/auto/chat/cardTitleOf';
import { delegationCardOf } from '../../features/auto/chat/delegationCardOf';
import { useAutoTreeViews } from '../../features/auto/useAutoTreeViews';
import { AutoChildBrief } from '../../features/auto/child/AutoChildBrief';
import { AutoChildDock } from '../../features/auto/child/AutoChildDock';
import { AutoChildEnd } from '../../features/auto/child/AutoChildEnd';
import { executedRoutingOf } from '../../features/auto/executedRoutingOf';
import { useExecutedRoutingOf } from '../../features/auto/useExecutedRoutingOf';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly onClose: () => void;
};

export const AutoChildPane = ({ sessionId, agentId, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const isActive = useAppStore((state) => state.currentSessionId === sessionId);
  const navigate = useAppStore((state) => state.navigate);
  const views = useAutoTreeViews({ sessionId });
  const events = useTranscript(agentId);
  const images = useMemo(() => briefImagesOf({ events }), [events]);
  const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
  const tree = useMemo(() => autoTreeOfAgent({ views, agentId }), [views, agentId]);
  const delegation = tree?.kind === 'child' ? tree.delegation : null;
  const executed = useExecutedRoutingOf({ agent });
  const card = useMemo(
    () => (delegation === null ? null : delegationCardOf({ delegation, childAgent: agent })),
    [delegation, agent],
  );
  const insertions = useMemo((): ReadonlyArray<TranscriptInsertion> => {
    if (card === null || delegation === null || agent === null) {
      return [];
    }
    return [
      {
        key: `auto-child-brief-${agentId}`,
        beforeMs: 0,
        node: (
          <AutoChildBrief
            card={card}
            images={images}
            routing={executedRoutingOf({
              executed,
              fallback: { provider: card.provider, model: card.model, effort: card.effort },
            })}
          />
        ),
      },
      {
        key: `auto-child-end-${agentId}`,
        beforeMs: null,
        node: (
          <AutoChildEnd sessionId={sessionId} delegation={delegation} card={card} agent={agent} />
        ),
      },
    ];
  }, [agent, agentId, card, delegation, executed, images, sessionId]);

  if (session === null || agent === null || card === null || tree === null) {
    return (
      <DrawerFrame title="Agent" icon={CONCEPT_ICONS.agents} onClose={onClose}>
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.agents}
          title="This agent is no longer part of Auto"
          description="Pick another row in the Work list."
        />
      </DrawerFrame>
    );
  }

  return (
    <DrawerFrame
      title={card.task ?? cardTitleOf({ card })}
      icon={CONCEPT_ICONS.agents}
      scroll="self"
      onClose={onClose}
      action={
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            onClose();
            navigate({ to: agentPlace({ sessionId, agentId }) });
          }}
        >
          Open full
        </Button>
      }
    >
      <ChatView
        session={session}
        agentId={agentId}
        isActive={isActive}
        topInset="tight"
        mode="conversation"
        composerPlaceholder={`Message ${card.roleLabel}`}
        composerLead={<AutoChildDock />}
        insertions={insertions}
      />
    </DrawerFrame>
  );
};
