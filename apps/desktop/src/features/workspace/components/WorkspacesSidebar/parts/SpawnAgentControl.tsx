import { useState, type ChangeEventHandler, type MouseEventHandler } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel } from '@goodboy/core';
import { Divider, Select, cn } from '@goodboy/ui';
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
    <div className={cn('relative min-w-0 overflow-visible pl-2', className)}>
      <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-md border border-dashed border-border-soft bg-muted/20">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <Plus size={13} aria-hidden className="shrink-0" />
          <span className="truncate">Create agent</span>
        </button>
        {agentKinds.length > 1 && (
          <>
            <Divider orientation="vertical" className="h-4 self-auto" />
            <Select
              size="sm"
              value={selectedRole}
              onChange={onRoleChange}
              aria-label="agent role"
              className="h-7 min-w-0 max-w-28 border-0 bg-transparent text-xs text-muted-foreground shadow-none hover:border-transparent hover:bg-muted/50 hover:text-foreground"
            >
              {agentKinds.map((kind) => (
                <option key={kind} value={kind} title={AGENT_KIND_META[kind].hint}>
                  {AGENT_KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </>
        )}
        <Divider orientation="vertical" className="h-4 self-auto" />
        <div className="min-w-0 [&>div>button]:max-w-full [&>div>button]:bg-transparent [&>div>button]:ring-0 [&>div>button]:hover:bg-muted/50">
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
      </div>
    </div>
  );
};
