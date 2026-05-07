import type { IsoDateTime, ProviderRunId, SessionId } from './ids';
import type { ProviderName } from './provider';

export interface ProviderCapabilities {
  readonly streaming: boolean;
  readonly toolUse: boolean;
  readonly fileEdits: boolean;
  readonly contextWindow: number;
  readonly defaultModel: string;
  readonly availableModels: ReadonlyArray<string>;
}

export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly estimatedCostUsd: number;
}

export type DetectResult =
  | { kind: 'available'; binary: string; version: string }
  | { kind: 'missing'; binary: string; reason: string };

export type PermissionMode = 'default' | 'bypassPermissions' | 'plan' | 'acceptEdits';

export interface TurnPermissionFlags {
  readonly mode: PermissionMode;
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
}

export interface TurnRequest {
  readonly runId: ProviderRunId;
  readonly sessionId: SessionId;
  readonly model: string;
  readonly workingDir: string;
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly permissionFlags?: TurnPermissionFlags;
}

export type TurnEvent =
  | { kind: 'assistant_text'; runId: ProviderRunId; delta: string; at: IsoDateTime }
  | {
      kind: 'tool_call_start';
      runId: ProviderRunId;
      toolUseId: string;
      toolName: string;
      input: unknown;
      at: IsoDateTime;
    }
  | {
      kind: 'tool_call_end';
      runId: ProviderRunId;
      toolUseId: string;
      output: unknown;
      isError: boolean;
      at: IsoDateTime;
    }
  | {
      kind: 'file_edit';
      runId: ProviderRunId;
      path: string;
      editType: 'create' | 'modify' | 'delete';
      at: IsoDateTime;
    }
  | { kind: 'usage'; runId: ProviderRunId; usage: ProviderUsage; at: IsoDateTime }
  | { kind: 'error'; runId: ProviderRunId; message: string; at: IsoDateTime }
  | { kind: 'done'; runId: ProviderRunId; at: IsoDateTime }
  | {
      kind: 'skill_invocation';
      runId: ProviderRunId;
      skillName: string;
      args: ReadonlyArray<string>;
      at: IsoDateTime;
    }
  | {
      kind: 'phase_transition';
      runId: ProviderRunId;
      fromPhase: { ordinal: number; name: string };
      toPhase: { ordinal: number; name: string };
      carryForwardContext: string;
      at: IsoDateTime;
    };

export interface ProviderAdapter {
  readonly id: ProviderName;
  readonly capabilities: ProviderCapabilities;
  detect(): Promise<DetectResult>;
  spawn(request: TurnRequest): AsyncIterable<TurnEvent>;
  cost(usage: ProviderUsage, model: string): number;
}
