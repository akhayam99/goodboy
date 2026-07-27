import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel } from '@goodboy/core';
import { Button, Divider, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import {
  AGENT_KIND_META,
  kindRouting,
  visibleAgentKinds,
  type AgentKind,
  type AgentKindRouting,
} from '../../agent-kind';
import { AgentKindGrid } from './AgentKindGrid';
import { AgentRoutingSections } from './AgentRoutingSections';
import { CreateAgentTrigger, type CreateAgentTriggerVariant } from './CreateAgentTrigger';

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
    expectedHeight: 440,
    width: 'w-[22rem] max-w-[calc(100vw-2rem)]',
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
  const recommended = kindRouting({ kind: selectedKind, roleModels });
  const [viewProvider, setViewProvider] = useState<ProviderId>(recommended.provider);

  useEffect(() => {
    if (open) {
      return;
    }
    setViewProvider(routing?.provider ?? recommended.provider);
  }, [open, routing, recommended.provider]);

  const onPickEffort = (effort: AgentKindRouting['effort']) => {
    setRouting({
      provider: routing?.provider ?? recommended.provider,
      model: routing?.model ?? recommended.model,
      effort,
    });
  };

  const onCreate = async () => {
    await spawnAgent(sessionId, {
      kindOverride: selectedKind,
      ...(routing != null && {
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
      }),
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
          <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[26rem]">
            {agentKinds.length > 1 && (
              <>
                <PickerSection label="Agent type" hint="What this agent is allowed to do">
                  <AgentKindGrid kinds={agentKinds} value={selectedKind} onChange={setKind} />
                </PickerSection>
                <Divider />
              </>
            )}
            <AgentRoutingSections
              connectedProviders={connectedProviders}
              recommended={recommended}
              routing={routing}
              viewProvider={viewProvider}
              onViewProvider={setViewProvider}
              onPickProvider={(provider) => {
                const model = getDefaultTurnModel(provider);
                setRouting({
                  provider,
                  model,
                  effort: clampEffort(model, routing?.effort ?? recommended.effort),
                });
              }}
              onPickModel={(model) => {
                if (model === '') {
                  setRouting(null);
                  return;
                }
                setRouting({
                  provider: viewProvider,
                  model,
                  effort: clampEffort(model, routing?.effort ?? recommended.effort),
                });
              }}
              onPickEffort={onPickEffort}
              onUseRecommended={() => {
                setRouting(null);
                setViewProvider(recommended.provider);
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
          </ScrollFade>
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
