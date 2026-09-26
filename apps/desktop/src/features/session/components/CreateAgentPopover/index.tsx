import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import {
  AnchoredPopover,
  Button,
  cn,
  Divider,
  PopoverBody,
  PopoverFooter,
  formatError,
  useDropdown,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { selectResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import {
  AGENT_KIND_META,
  KIND_TO_ROLE,
  visibleAgentKinds,
  type AgentKind,
  type AgentKindRouting,
} from '../../agent-kind';
import { AGENT_FORM_GRAMMAR } from '../../agent-form-grammar';
import { resolveSpawnRouting } from '../../spawn-routing';
import { useSuggestedRouting } from '../../hooks/useSuggestedRouting';
import { isSameRouting } from '../../isSameRouting';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { AgentRoleField } from '../AgentRoleField';
import { AgentKindGrid } from './AgentKindGrid';
import { LaunchEstimateNote } from './LaunchEstimateNote';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { CreateAgentTrigger } from './CreateAgentTrigger';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';

const ROUTING_PANEL_ID = 'create-agent-routing';

const CHAT_ROUTING_REASON = 'Same model as this chat.';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
  readonly onSpawned?: () => void;
};

export const CreateAgentPopover = ({ sessionId, className, onSpawned }: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    expectedHeight: 460,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const [kind, setKind] = useState<AgentKind>('generic');
  const [routing, setRouting] = useState<AgentKindRouting | null>(null);
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
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
  const roleModels = useSessionRoleModels({ sessionId });
  const session = useAppStore((state) => state.sessions?.find((s) => s.id === sessionId) ?? null);
  const defaultProvider = useAppStore(
    (state) => selectResolvedSettings({ state, sessionId })?.defaultProviderId ?? null,
  );
  const spawnDefault = resolveSpawnRouting({
    kind: selectedKind,
    roleModels,
    session,
    defaultProvider,
  });
  const activePlan = useAppStore((state) => {
    const plans = state.sessionPlans[sessionId] ?? [];
    const latest = plans[plans.length - 1] ?? null;
    return latest?.status === 'active' ? latest : null;
  });
  const kindLabel = AGENT_KIND_META[selectedKind].noun;
  const planToStart = selectedKind === 'implementer' ? activePlan : null;
  const actionLabel = planToStart == null ? `Open ${kindLabel}` : `Start ${kindLabel} on the plan`;
  const actionNote =
    planToStart == null
      ? 'You write the first message in its chat.'
      : `Starts now from plan: ${planToStart.title}`;
  const suggested = useSuggestedRouting({ sessionId, role: KIND_TO_ROLE[selectedKind] });
  const suggestion: AgentKindRouting = {
    provider: spawnDefault.provider,
    model: spawnDefault.model,
    effort: spawnDefault.effort,
  };
  const suggestionReason = spawnDefault.origin === 'chat' ? CHAT_ROUTING_REASON : suggested.reason;
  const lastAgent = useAppStore(
    (state) =>
      [...(state.sessionPhaseRuns[sessionId] ?? [])]
        .reverse()
        .find(
          (agent) =>
            agent.kind === selectedKind &&
            agent.providerOverride != null &&
            agent.modelOverride != null,
        ) ?? null,
  );
  const lastRouting: AgentKindRouting | null =
    lastAgent?.providerOverride == null || lastAgent.modelOverride == null
      ? null
      : {
          provider: lastAgent.providerOverride,
          model: lastAgent.modelOverride,
          effort: lastAgent.effort ?? suggestion.effort,
        };
  const lastUsed =
    lastRouting != null && !isSameRouting({ left: lastRouting, right: suggestion })
      ? lastRouting
      : null;
  const effective: AgentKindRouting = routing ?? suggestion;
  const routingSummary = recommendationSummary({
    provider: effective.provider,
    model: effective.model,
    effort: effective.effort,
  });

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
      });
      setKind('generic');
      setRouting(null);
      setIsRoutingOpen(false);
      close();
      if (onSpawned != null) {
        onSpawned();
      }
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (err) {
      setSpawnError(formatError(err));
    } finally {
      isSpawningRef.current = false;
      setIsSpawning(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Start agent"
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName="min-w-0"
      trigger={<CreateAgentTrigger isOpen={open} className={className} onClick={toggle} />}
    >
      <PopoverBody>
        {agentKinds.length > 1 ? (
          <PickerSection label={AGENT_FORM_GRAMMAR.role.label}>
            <AgentKindGrid kinds={agentKinds} value={selectedKind} onChange={setKind} />
          </PickerSection>
        ) : (
          <AgentRoleField
            role={{
              label: AGENT_KIND_META[selectedKind].label,
              hint: AGENT_KIND_META[selectedKind].hint,
            }}
            className="px-2.5 py-1.5"
          />
        )}
        <PickerSection label={AGENT_FORM_GRAMMAR.routing.label}>
          <div className="px-2.5">
            <button
              type="button"
              onClick={() => setIsRoutingOpen((current) => !current)}
              aria-expanded={isRoutingOpen}
              aria-controls={ROUTING_PANEL_ID}
              aria-label={`${AGENT_FORM_GRAMMAR.routing.ariaLabel}: ${routingSummary}`}
              className="flex w-full items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1.5 text-left text-label text-foreground motion-safe:transition-colors hover:border-border hover:bg-hover"
            >
              <span className="flex min-w-0 flex-1">
                {effective.model == null ? (
                  <span className="truncate">{routingSummary}</span>
                ) : (
                  <RoutingLabel
                    provider={effective.provider}
                    model={effective.model}
                    effort={effective.effort ?? null}
                  />
                )}
              </span>
              <ChevronDown
                size={11}
                aria-hidden
                className={cn(
                  'shrink-0 text-muted-foreground motion-safe:transition-transform',
                  isRoutingOpen && 'rotate-180',
                )}
              />
            </button>
          </div>
        </PickerSection>
        {isRoutingOpen && (
          <div id={ROUTING_PANEL_ID} className="flex flex-col pt-1.5">
            <RoutingPickerBody
              connectedProviders={connectedProviders}
              provider={effective.provider}
              model={effective.model}
              effort={{
                editable: true,
                value: effective.effort,
                onChange: (effort) =>
                  setRouting((current) => ({ ...(current ?? spawnDefault), effort })),
              }}
              onClose={close}
              recommendation={{ ...suggestion, label: SUGGESTED_LABEL, reason: suggestionReason }}
              overridden={routing !== null}
              {...(lastUsed != null && {
                lastUsed: {
                  routing: lastUsed,
                  active: routing !== null && isSameRouting({ left: routing, right: lastUsed }),
                  onSelect: () => setRouting(lastUsed),
                },
              })}
              onProvider={(provider) => {
                if (provider === '') {
                  setRouting(null);
                  return;
                }
                setRouting((current) => ({ ...(current ?? spawnDefault), provider }));
              }}
              onModel={(model) =>
                setRouting((current) => {
                  const base = current ?? spawnDefault;
                  return {
                    ...base,
                    model,
                    effort: clampEffortForModel({ model, effort: base.effort }) ?? base.effort,
                  };
                })
              }
            />
          </div>
        )}
      </PopoverBody>
      <Divider />
      <PopoverFooter className="flex items-center justify-end gap-2 px-2.5 py-2">
        {spawnError === null ? (
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-secondary text-faint-foreground">{actionNote}</span>
            <LaunchEstimateNote
              workspaceId={session?.workspaceId ?? null}
              kind={selectedKind}
              routing={effective}
              isShown={open && planToStart != null}
            />
          </span>
        ) : (
          <span role="alert" className="min-w-0 flex-1 text-secondary text-danger">
            {spawnError}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => void onCreate()}
          disabled={isSpawning}
          isBusy={isSpawning}
          busyLabel={`Starting ${kindLabel}`}
        >
          {actionLabel}
        </Button>
      </PopoverFooter>
    </AnchoredPopover>
  );
};
