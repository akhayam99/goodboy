import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Band, Eyebrow, formatTokens } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionSlots } from '../../../../../store';
import { liveAgentsOf } from '../../../../../store/runtime/live-work/liveAgentsOf';
import { NAMES } from '../../../../../shared/utils/names';
import { agentDisplayName } from '../../../../../shared/utils/agentDisplayName';
import { useSessionRunHistory } from '../../../../../shared/hooks/useSessionRunHistory';
import { CONTEXT_CARD_BODY } from '../contextCardBody';
import { ContextCardHead } from '../ContextCardHead';
import { SendRoleRow } from '../SendRoleRow';
import { SendAskRow } from '../SendAskRow';
import { AgentFillRow } from '../AgentFillRow';
import { activeUsageOf } from '../activeUsageOf';
import { contextFillOf } from '../contextFillOf';
import { sendRowsOf } from '../sendRowsOf';

type Props = {
  readonly sessionId: SessionId;
};

export const SendsSection = ({ sessionId }: Props) => {
  const slots = useSessionSlots(sessionId);
  const agents = useAppStore(useShallow((state) => liveAgentsOf({ state, sessionId })));
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? EMPTY_ARRAY);
  const runHistory = useSessionRunHistory({ sessionId });
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
          <div className="px-2 py-1">
            <Eyebrow label="Default for each role" />
          </div>
          {model.rows.map((row) => (
            <SendRoleRow key={row.key} row={row} />
          ))}
          <SendRoleRow row={model.leadChild} note="Agents the Lead starts read only their brief" />
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
                    usage: activeUsageOf({ agent, runIds: runHistory[agent.id], telemetry }),
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
