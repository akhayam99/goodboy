import { openPermissionAsksOf } from '../../permissions/openPermissionAsksOf';
import type { PermissionDecision } from '../contract/decisions';
import { permissionHashOf } from '../actions/versions';
import { actionIdOf } from './actionIdOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

type InputParams = {
  readonly input: unknown;
};

const permissionCommandOf = ({ input }: InputParams): string => {
  if (typeof input === 'object' && input !== null) {
    const record: Record<string, unknown> = { ...input };
    for (const key of ['command', 'file_path', 'path', 'url', 'pattern']) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return JSON.stringify(input) ?? '';
};

export const permissionDecisionOf = ({ scope, sessionId }: Params): PermissionDecision | null => {
  for (const agent of scope.agents[sessionId] ?? []) {
    const asks = openPermissionAsksOf({
      events: scope.transcripts[agent.id] ?? [],
      turnState: scope.turnStates[agent.id],
    });
    const ask = asks[0];
    if (ask === undefined) {
      continue;
    }
    const inputHash = permissionHashOf({ toolName: ask.toolName, input: ask.input });
    const command = safeTextOf({ text: permissionCommandOf({ input: ask.input }), max: 400 });
    return {
      kind: 'permission',
      actionId: actionIdOf({
        kind: 'answerPermission',
        objectId: ask.toolUseId,
        version: inputHash,
      }),
      agentId: agent.id,
      requestId: ask.toolUseId,
      inputHash,
      toolName: safeTextOf({ text: ask.toolName, max: 80 }),
      inputSummary: safeTextOf({ text: command, max: 160 }),
      command,
    };
  }
  return null;
};
