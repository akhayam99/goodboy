import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Band, Eyebrow, formatTokens } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSessionSlots } from '../../../../../store';
import { liveAgentsOf } from '../../../../../store/runtime/live-work/liveAgentsOf';
import { NAMES } from '../../../../../shared/utils/names';
import { agentDisplayName } from '../../../../../shared/utils/agentDisplayName';
import { useAgentMetrics } from '../../../hooks/useAgentMetrics';
import { CONTEXT_CARD_BODY } from '../contextCardBody';
import { ContextCardHead } from '../ContextCardHead';
import { SendRoleRow } from '../SendRoleRow';
import { SendAskRow } from '../SendAskRow';
import { AgentFillRow } from '../AgentFillRow';
import { contextFillOf } from '../contextFillOf';
import { sendRowsOf } from '../sendRowsOf';

type Props = {
  readonly sessionId: SessionId;
};

export const SendsSection = ({ sessionId }: Props) => {
  const slots = useSessionSlots(sessionId);
  const agents = useAppStore(useShallow((state) => liveAgentsOf({ state, sessionId })));
  const metrics = useAgentMetrics({ sessionId });
  const model = useMemo(() => sendRowsOf({ slots }), [slots]);

  return (
    <section
      aria-label={NAMES.whatGoodboySends}
      data-context-section="sends"
      data-context-card=""
      className="min-w-0 scroll-mt-3"
    >
      <Band className="min-w-0">
        <ContextCardHead
          label={NAMES.whatGoodboySends}
          actions={
            <span className="px-1 text-meta tabular-nums text-faint-foreground">
              {`Up to ${formatTokens(model.budgetTokens)} tokens a turn`}
            </span>
          }
        />
        <div className={CONTEXT_CARD_BODY.rows}>
          {model.rows.map((row) => (
            <SendRoleRow key={row.key} row={row} />
          ))}
          <SendAskRow />
          {agents.length === 0 ? null : (
            <>
              <div className="px-2 py-1">
                <Eyebrow label={NAMES.contextWindow} />
              </div>
              {agents.map((agent) => (
                <AgentFillRow
                  key={agent.id}
                  name={agentDisplayName({ name: agent.name, kind: agent.kind ?? '' })}
                  fill={contextFillOf({
                    usage: metrics.providerUsageByAgentId.get(agent.id)?.[0] ?? null,
                  })}
                />
              ))}
            </>
          )}
        </div>
      </Band>
    </section>
  );
};
