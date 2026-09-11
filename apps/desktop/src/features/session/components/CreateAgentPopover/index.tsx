import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel } from '@goodboy/core';
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
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  clampEffort,
  modelLabel,
} from '../../../chat/utils/chat-constants';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import {
  AGENT_KIND_META,
  visibleAgentKinds,
  type AgentKind,
  type AgentKindRouting,
} from '../../agent-kind';
import { AGENT_FORM_GRAMMAR } from '../../agent-form-grammar';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AgentInstructionsField } from '../AgentInstructionsField';
import { AgentRoleField } from '../AgentRoleField';
import { AgentKindGrid } from './AgentKindGrid';
import { AgentRoutingSections } from './AgentRoutingSections';
import { CreateAgentTrigger, type CreateAgentTriggerVariant } from './CreateAgentTrigger';

const ROUTING_PANEL_ID = 'create-agent-routing';

type Props = {
  readonly sessionId: SessionId;
  readonly variant?: CreateAgentTriggerVariant;
  readonly className?: string;
  readonly description?: string;
  readonly onSpawned?: () => void;
};

export const CreateAgentPopover = ({
  sessionId,
  variant = 'tile',
  className,
  description,
  onSpawned,
}: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    expectedHeight: 460,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { open, close, toggle } = dropdown;
  const [kind, setKind] = useState<AgentKind>('generic');
  const [routing, setRouting] = useState<AgentKindRouting | null>(null);
  const [instructions, setInstructions] = useState('');
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
  const spawnDefault = resolveSpawnRouting({ kind: selectedKind, roleModels, session });
  const effective: AgentKindRouting = routing ?? spawnDefault;
  const [viewProvider, setViewProvider] = useState<ProviderId>(spawnDefault.provider);
  const routingSummary = `${PROVIDER_LABEL[effective.provider]} · ${modelLabel(effective.model)} · ${
    EFFORT_LABEL[effective.effort]
  }`;

  useEffect(() => {
    setViewProvider(routing?.provider ?? spawnDefault.provider);
  }, [open, selectedKind, routing, spawnDefault.provider]);

  const onCreate = async () => {
    if (isSpawningRef.current) {
      return;
    }
    isSpawningRef.current = true;
    setIsSpawning(true);
    setSpawnError(null);
    const trimmedInstructions = instructions.trim();
    try {
      await spawnAgent(sessionId, {
        kindOverride: selectedKind,
        provider: effective.provider,
        model: effective.model,
        effort: effective.effort,
        ...(trimmedInstructions !== '' && { initialPrompt: trimmedInstructions }),
        focus: 'agent',
      });
      setKind('generic');
      setRouting(null);
      setInstructions('');
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
      ariaLabel="Create agent"
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName={cn('min-w-0', variant === 'tile' && 'w-full')}
      trigger={
        <CreateAgentTrigger
          variant={variant}
          isOpen={open}
          description={description}
          className={cn(variant === 'tile' && 'w-full', className)}
          onClick={toggle}
        />
      }
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
        <Divider />
        <AgentInstructionsField
          value={instructions}
          onChange={setInstructions}
          disabled={isSpawning}
          className="px-2.5 py-1.5"
        />
        <Divider />
        <PickerSection label={AGENT_FORM_GRAMMAR.routing.label}>
          <div className="px-2.5">
            <button
              type="button"
              onClick={() => setIsRoutingOpen((current) => !current)}
              aria-expanded={isRoutingOpen}
              aria-controls={ROUTING_PANEL_ID}
              aria-label={`${AGENT_FORM_GRAMMAR.routing.ariaLabel}: ${routingSummary}`}
              className="flex w-full items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1.5 text-left text-xs text-foreground motion-safe:transition-colors hover:border-border hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate">{routingSummary}</span>
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
          <div id={ROUTING_PANEL_ID}>
            <Divider />
            <AgentRoutingSections
              connectedProviders={connectedProviders}
              effective={effective}
              viewProvider={viewProvider}
              onViewProvider={setViewProvider}
              onNavigateProviders={close}
              onPickProvider={(provider) => {
                const model = getDefaultTurnModel({ id: provider });
                setRouting({
                  provider,
                  model,
                  effort: clampEffort(model, effective.effort),
                });
              }}
              onPickModel={(model, effort) => {
                setRouting({
                  provider: viewProvider,
                  model,
                  effort,
                });
              }}
            />
          </div>
        )}
      </PopoverBody>
      <Divider />
      <PopoverFooter className="flex items-center justify-end gap-2 px-2.5 py-2">
        {spawnError === null ? null : (
          <span role="alert" className="min-w-0 flex-1 text-2xs text-danger">
            {spawnError}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => void onCreate()}
          disabled={isSpawning}
          isBusy={isSpawning}
          busyLabel={`Spawning ${AGENT_KIND_META[selectedKind].label}`}
        >
          Spawn {AGENT_KIND_META[selectedKind].label}
        </Button>
      </PopoverFooter>
    </AnchoredPopover>
  );
};
