import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ROW_INTERACTIVE, Button, cn, FormActions, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentRouting } from '../hooks/useAgentRouting';
import { PickerSection } from '../../../shared/components/RoutingPicker/PickerSection';
import { Docked } from '../../../shared/components/Docked';
import { AGENT_KIND_META, visibleAgentKinds, type AgentKind } from '../agent-kind';
import { AGENT_FORM_GRAMMAR } from '../agent-form-grammar';
import { isSameRouting } from '../isSameRouting';
import { SUGGESTED_LABEL } from '../../../shared/components/RoutingPicker/autoRecommendationCopy';
import { AgentRoleField } from './AgentRoleField';
import { AgentKindGrid } from './CreateAgentPopover/AgentKindGrid';
import { LaunchEstimateNote } from './CreateAgentPopover/LaunchEstimateNote';
import { RoutingPickerBody } from '../../../shared/components/RoutingPicker/RoutingPickerBody';
import { recommendationSummary } from '../../../shared/components/RoutingPicker/recommendationSummary';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { openAgentRevealEvent } from '../../../shared/utils/openAgentReveal';
import { useConfirmStartMode } from '../../auto/useConfirmStartMode';

const ROUTING_PANEL_ID = 'create-agent-routing';

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
  footerClassName = 'px-3 pb-2 pt-3',
  onDone,
  onSpawned,
}: Props) => {
  const [kind, setKind] = useState<AgentKind>('generic');
  const [isRoutingOpen, setIsRoutingOpen] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const isSpawningRef = useRef(false);
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const confirmMode = useConfirmStartMode();
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
  const actionLabel = planToStart == null ? `Open ${kindLabel}` : `Start ${kindLabel} on the plan`;
  const actionNote =
    planToStart == null
      ? 'You write the first message in its chat.'
      : `Starts now from plan: ${planToStart.title}`;
  const choice = useAgentRouting({ sessionId, kind: selectedKind });
  const { routing, effective, suggestion, suggestionReason, lastUsed } = choice;
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
      if (!(await confirmMode({ isShown: false }))) {
        return;
      }
      await spawnAgent(sessionId, {
        kindOverride: selectedKind,
        provider: effective.provider,
        model: effective.model,
        effort: effective.effort,
        focus: 'agent',
      });
      setKind('generic');
      choice.reset();
      setIsRoutingOpen(false);
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
    <>
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
          className="px-3 py-2"
        />
      )}
      <PickerSection label={AGENT_FORM_GRAMMAR.routing.label}>
        <div className="px-3">
          <button
            type="button"
            onClick={() => setIsRoutingOpen((isOpen) => !isOpen)}
            aria-expanded={isRoutingOpen}
            aria-controls={ROUTING_PANEL_ID}
            aria-label={`${AGENT_FORM_GRAMMAR.routing.ariaLabel}: ${routingSummary}`}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border border-border-soft bg-subtle px-2 py-2 text-left text-label text-foreground hover:border-border',
              ROW_INTERACTIVE,
            )}
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
              size={ICON_SIZE.row}
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
        <div id={ROUTING_PANEL_ID} className="flex flex-col pt-2">
          <RoutingPickerBody
            connectedProviders={connectedProviders}
            provider={effective.provider}
            model={effective.model}
            effort={{ editable: true, value: effective.effort }}
            onClose={onDone}
            recommendation={{ ...suggestion, label: SUGGESTED_LABEL, reason: suggestionReason }}
            overridden={routing !== null}
            {...(lastUsed != null && {
              lastUsed: {
                routing: lastUsed,
                active: routing !== null && isSameRouting({ left: routing, right: lastUsed }),
                onSelect: choice.pickLastUsed,
              },
            })}
            onChange={choice.pick}
          />
        </div>
      )}
      <Docked node={actionsHost}>
        <FormActions
          className={footerClassName}
          leading={
            spawnError === null ? (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-meta text-faint-foreground">{actionNote}</span>
                <LaunchEstimateNote
                  workspaceId={session?.workspaceId ?? null}
                  kind={selectedKind}
                  routing={effective}
                  isShown={isShown && planToStart != null}
                />
              </span>
            ) : (
              <span role="alert" className="min-w-0 text-meta text-danger">
                {spawnError}
              </span>
            )
          }
        >
          <Button
            size="sm"
            onClick={() => void onCreate()}
            disabled={isSpawning}
            isBusy={isSpawning}
            busyLabel={`Starting ${kindLabel}`}
          >
            {actionLabel}
          </Button>
        </FormActions>
      </Docked>
    </>
  );
};
