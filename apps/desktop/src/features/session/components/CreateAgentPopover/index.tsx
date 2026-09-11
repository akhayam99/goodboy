import { useEffect, useRef, useState } from 'react';
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
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { PickerSection } from '../../../../shared/components/RoutingPicker/PickerSection';
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
      close();
      if (onSpawned != null) {
        onSpawned();
        return;
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
        {agentKinds.length > 1 && (
          <>
            <PickerSection label="Agent type">
              <AgentKindGrid kinds={agentKinds} value={selectedKind} onChange={setKind} />
            </PickerSection>
            <Divider />
          </>
        )}
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
