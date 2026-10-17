import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, FormActions, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentRouting } from '../hooks/useAgentRouting';
import { Docked } from '../../../shared/components/Docked';
import { PromptField } from '../../../shared/components/PromptField';
import { startRoleLabel } from '../../../shared/lib/startCopy';
import { AGENT_KIND_META, visibleAgentKinds, type AgentKind } from '../agent-kind';
import { isSameRouting } from '../isSameRouting';
import { AgentStartFields } from './AgentStartFields';
import { LaunchEstimateNote } from './CreateAgentPopover/LaunchEstimateNote';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { openAgentRevealEvent } from '../../../shared/utils/openAgentReveal';
import { NAMES } from '../../../shared/names';

type Props = {
  readonly sessionId: SessionId;
  readonly isShown: boolean;
  readonly actionsHost?: HTMLElement | null;
  readonly footerClassName?: string;
  readonly onDone: () => void;
  readonly onSpawned?: () => void;
};

export const AgentStartBlock = ({
  sessionId,
  isShown,
  actionsHost,
  footerClassName,
  onDone,
  onSpawned,
}: Props) => {
  const [kind, setKind] = useState<AgentKind>('generic');
  const [goal, setGoal] = useState('');
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const isSpawningRef = useRef(false);
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const agentKinds = visibleAgentKinds();
  const selectedKind = agentKinds.includes(kind) ? kind : (agentKinds[0] ?? 'generic');
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const activePlan = useAppStore((state) => {
    const plans = state.sessionPlans[sessionId] ?? [];
    const latest = plans[plans.length - 1] ?? null;
    return latest?.status === 'active' ? latest : null;
  });
  const kindLabel = AGENT_KIND_META[selectedKind].noun;
  const planToStart = selectedKind === 'implementer' ? activePlan : null;
  const prompt = goal.trim();
  const actionLabel =
    planToStart == null
      ? startRoleLabel({ noun: kindLabel })
      : `${startRoleLabel({ noun: kindLabel })} on the plan`;
  const actionNote =
    planToStart == null
      ? prompt === ''
        ? 'With no goal you write the first message in its chat.'
        : null
      : `Starts now from plan: ${planToStart.title}`;
  const choice = useAgentRouting({ sessionId, kind: selectedKind });
  const { routing, effective, suggestion, suggestionReason, lastUsed } = choice;

  const onCreate = async () => {
    if (isSpawningRef.current) {
      return;
    }
    isSpawningRef.current = true;
    setIsSpawning(true);
    setSpawnError(null);
    try {
      await spawnAgent(sessionId, {
        kindOverride: selectedKind,
        provider: effective.provider,
        model: effective.model,
        effort: effective.effort,
        focus: 'agent',
        ...(prompt !== '' && { initialPrompt: prompt }),
      });
      setKind('generic');
      setGoal('');
      choice.reset();
      onDone();
      if (onSpawned != null) {
        onSpawned();
      }
      window.dispatchEvent(openAgentRevealEvent());
    } catch (err) {
      setSpawnError(formatError(err));
    } finally {
      isSpawningRef.current = false;
      setIsSpawning(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PromptField
        kind="document"
        label="Agent instructions"
        value={goal}
        onChange={setGoal}
        onSubmit={() => void onCreate()}
        isSubmitBlocked={isSpawning}
        placeholder={`What should ${kindLabel} do?`}
        minRows={3}
        maxRows={10}
        keyLabels={{ send: 'start' }}
        disabled={isSpawning}
      />
      <Docked node={actionsHost}>
        <FormActions
          {...(footerClassName !== undefined && { className: footerClassName })}
          leading={
            <AgentStartFields
              kinds={agentKinds}
              kind={selectedKind}
              onKindChange={setKind}
              routing={routing}
              suggestion={suggestion}
              suggestionReason={suggestionReason}
              lastUsed={
                lastUsed == null
                  ? null
                  : {
                      routing: lastUsed,
                      isActive:
                        routing !== null && isSameRouting({ left: routing, right: lastUsed }),
                      onSelect: choice.pickLastUsed,
                    }
              }
              connectedProviders={connectedProviders}
              isDisabled={isSpawning}
              onRoutingChange={(next) => (next === null ? choice.reset() : choice.pick(next))}
            />
          }
          reason={spawnError === null ? actionNote : null}
          error={spawnError}
        >
          <Button
            size="sm"
            onClick={() => void onCreate()}
            disabled={isSpawning}
            isBusy={isSpawning}
            busyLabel={`Starting ${kindLabel}`}
          >
            {spawnError === null ? actionLabel : NAMES.retry}
          </Button>
        </FormActions>
        <LaunchEstimateNote
          workspaceId={session?.workspaceId ?? null}
          kind={selectedKind}
          routing={effective}
          isShown={isShown && planToStart != null}
        />
      </Docked>
    </div>
  );
};
