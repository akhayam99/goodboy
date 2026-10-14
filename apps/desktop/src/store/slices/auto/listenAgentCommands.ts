import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { formatError } from '@goodboy/ui';
import { brandId, type AgentId, type AutoTreeId, type SessionId } from '@goodboy/types';
import { isMainWindow } from '../../../features/workspace/window';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { AgentCommand, BridgeOutcome } from './ports';

const AGENT_EVENT = 'query-bridge://agent-command';

type AgentEvent = Readonly<{
  id: string;
  verb: string;
  args: Readonly<Record<string, unknown>>;
  grant: Readonly<{
    agentId: string;
    treeId: string;
    generation: number;
    workspaceId: string;
    sessionId: string;
    runId: string;
  }>;
}>;

export type ListenAgentCommandsParams = Readonly<{
  handle: (command: AgentCommand) => Promise<BridgeOutcome>;
}>;

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type CommandOfParams = {
  readonly event: AgentEvent;
};

export const commandOfEvent = ({ event }: CommandOfParams): AgentCommand => ({
  verb: event.verb,
  args: event.args,
  grant: {
    agentId: brandId<AgentId>({ value: event.grant.agentId }),
    treeId: brandId<AutoTreeId>({ value: event.grant.treeId }),
    generation: event.grant.generation,
    workspaceId: event.grant.workspaceId,
    sessionId: brandId<SessionId>({ value: event.grant.sessionId }),
    runId: event.grant.runId,
  },
});

export const listenAgentCommands = async ({
  handle,
}: ListenAgentCommandsParams): Promise<UnlistenFn> => {
  if (!inTauri() || !isMainWindow()) {
    return () => undefined;
  }
  return listen<AgentEvent>(AGENT_EVENT, (event) => {
    const payload = event.payload;
    void handle(commandOfEvent({ event: payload }))
      .catch((error): BridgeOutcome => ({ isOk: false, error: formatError(error) }))
      .then((result) =>
        invokeCommand('mount_command_result', {
          id: payload.id,
          ok: result.isOk,
          error: result.error ?? null,
          code: result.code ?? null,
          data: result.data ?? null,
        }),
      )
      .catch((error) => console.error('[query-bridge] agent result dispatch failed', error));
  });
};
