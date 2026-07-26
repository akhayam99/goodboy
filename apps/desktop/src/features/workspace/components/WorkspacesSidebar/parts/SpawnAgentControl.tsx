import { useState, type ChangeEventHandler, type MouseEventHandler } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel } from '@goodboy/core';
import { Select, cn } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { ProviderId, SessionId } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace } from '../../../../../store';
import { clampEffort } from '../../../../chat/utils/chat-constants';
import {
  AGENT_KIND_META,
  kindRouting,
  type AgentKind,
  type AgentKindRouting,
  visibleAgentKinds,
} from '../../../../session/agent-kind';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { useSessionRoleModels } from '../../../../../shared/hooks/useSessionRoleModels';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
  readonly onSpawned?: () => void;
};

export const SpawnAgentControl = ({ sessionId, className, onSpawned }: Props) => {
  const [role, setRole] = useState<AgentKind>('generic');
  const [routing, setRouting] = useState<AgentKindRouting | null>(null);
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const workspaceKind = useCurrentWorkspace()?.kind;
  const agentKinds = visibleAgentKinds({ workspaceKind });
  const selectedRole = agentKinds.includes(role) ? role : (agentKinds[0] ?? 'generic');
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const roleModels = useSessionRoleModels({ sessionId });
  const recommendedRouting = kindRouting({ kind: selectedRole, roleModels });

  const onRoleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const nextRole = agentKinds.find((kind) => kind === event.target.value);
    if (nextRole == null) {
      return;
    }
    setRole(nextRole);
  };

  const onProvider = (provider: ProviderId | '') => {
    if (provider === '') {
      setRouting(null);
      return;
    }
    const model = getDefaultTurnModel(provider);
    setRouting({
      provider,
      model,
      effort: clampEffort(model, recommendedRouting.effort),
    });
  };

  const onCreate: MouseEventHandler<HTMLButtonElement> = async () => {
    await spawnAgent(sessionId, {
      kindOverride: selectedRole,
      ...(routing != null && {
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
      }),
    });
    setRole('generic');
    setRouting(null);
    if (onSpawned != null) {
      onSpawned();
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <div className={cn('relative flex flex-wrap items-center gap-2 overflow-visible', className)}>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-border-soft px-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
      >
        <Plus size={13} aria-hidden />
        Create agent
      </button>
      {agentKinds.length > 1 && (
        <Select
          size="sm"
          value={selectedRole}
          onChange={onRoleChange}
          aria-label="agent role"
          className="h-7 text-xs"
        >
          {agentKinds.map((kind) => (
            <option key={kind} value={kind} title={AGENT_KIND_META[kind].hint}>
              {AGENT_KIND_META[kind].label}
            </option>
          ))}
        </Select>
      )}
      <RoutingPicker
        variant="pill"
        align="end"
        ariaLabel="new agent routing"
        connectedProviders={connectedProviders}
        provider={routing?.provider ?? ''}
        model={routing?.model ?? ''}
        effort={routing?.effort ?? recommendedRouting.effort}
        recommendedProvider={recommendedRouting.provider}
        recommendedModel={recommendedRouting.model}
        disabled={false}
        overridden={routing != null}
        onProvider={onProvider}
        onModel={(model) => {
          if (model === '') {
            setRouting(null);
            return;
          }
          setRouting({
            provider: routing?.provider ?? recommendedRouting.provider,
            model,
            effort: clampEffort(model, routing?.effort ?? recommendedRouting.effort),
          });
        }}
        onEffort={(effort) =>
          setRouting({
            provider: routing?.provider ?? recommendedRouting.provider,
            model: routing?.model ?? recommendedRouting.model,
            effort,
          })
        }
      />
    </div>
  );
};
