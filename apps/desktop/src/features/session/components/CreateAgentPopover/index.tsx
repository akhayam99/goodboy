import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel } from '@goodboy/core';
import { Button, Divider, Popover, cn } from '@goodboy/ui';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import {
  AGENT_KIND_META,
  visibleAgentKinds,
  type AgentKind,
  type AgentKindRouting,
} from '../../agent-kind';
import { resolveSpawnRouting } from '../../spawn-routing';
import { AgentKindGrid } from './AgentKindGrid';
import { AgentRoutingSections } from './AgentRoutingSections';
import { CreateAgentTrigger, type CreateAgentTriggerVariant } from './CreateAgentTrigger';
import { SpawnRoutingSummary } from './SpawnRoutingSummary';

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
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    align: 'end',
    expectedHeight: 460,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const [kind, setKind] = useState<AgentKind>('generic');
  const [routing, setRouting] = useState<AgentKindRouting | null>(null);
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const workspaceKind = useCurrentWorkspace()?.kind;
  const agentKinds = visibleAgentKinds({ workspaceKind });
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

  useEffect(() => {
    setViewProvider(routing?.provider ?? spawnDefault.provider);
  }, [open, selectedKind, routing, spawnDefault.provider]);

  const onCreate = async () => {
    await spawnAgent(sessionId, {
      kindOverride: selectedKind,
      provider: effective.provider,
      model: effective.model,
      effort: effective.effort,
    });
    setKind('generic');
    setRouting(null);
    close();
    if (onSpawned != null) {
      onSpawned();
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <div ref={containerRef} className={cn('relative min-w-0', variant === 'tile' && 'w-full')}>
      <CreateAgentTrigger
        variant={variant}
        isOpen={open}
        description={description}
        className={cn(variant === 'tile' && 'w-full', className)}
        onClick={toggle}
      />
      {open && (
        <Popover
          role="dialog"
          ariaLabel="create agent"
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
        >
          {agentKinds.length > 1 && (
            <>
              <PickerSection label="Agent type" hint="What this agent is allowed to do">
                <AgentKindGrid kinds={agentKinds} value={selectedKind} onChange={setKind} />
              </PickerSection>
              <Divider />
            </>
          )}
          <SpawnRoutingSummary
            kind={selectedKind}
            effective={effective}
            fallback={spawnDefault}
            isPinned={routing != null}
            onReset={() => {
              setRouting(null);
              setViewProvider(spawnDefault.provider);
            }}
          />
          <Divider />
          <AgentRoutingSections
            connectedProviders={connectedProviders}
            effective={effective}
            viewProvider={viewProvider}
            onViewProvider={setViewProvider}
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
            onConnectProvider={(provider) => {
              window.dispatchEvent(
                new CustomEvent('goodboy:open-provider-studio', {
                  detail: { providerId: provider },
                }),
              );
              close();
            }}
          />
          <Divider />
          <div className="flex items-center justify-end px-2.5 py-2">
            <Button size="sm" onClick={() => void onCreate()}>
              Spawn {AGENT_KIND_META[selectedKind].label}
            </Button>
          </div>
        </Popover>
      )}
    </div>
  );
};
