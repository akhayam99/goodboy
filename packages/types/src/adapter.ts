import type { IsoDateTime, PermissionRuleId, ProviderRunId, SessionId } from './ids';
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
  // Cache-write tokens split by TTL bucket. Anthropic stream-json reports
  // `cache_creation_input_tokens` (5min default) and `cache_creation.ephemeral_1h_input_tokens`
  // (1h variant). Codex CLI does not surface cache writes today — these stay 0.
  // Optional to preserve back-compat with legacy persisted records.
  readonly cacheCreation5mTokens?: number;
  readonly cacheCreation1hTokens?: number;
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
  | { kind: 'user_text'; runId: ProviderRunId; text: string; at: IsoDateTime }
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
      // Emitted on the provider's first `system` event of a turn (claude init).
      // Carries the provider-side session id so the store can persist it per
      // agent and pass `--resume <id>` on the next turn.
      kind: 'provider_session_init';
      runId: ProviderRunId;
      providerSessionId: string;
      at: IsoDateTime;
    }
  | {
      kind: 'skill_invocation';
      runId: ProviderRunId;
      skillName: string;
      args: ReadonlyArray<string>;
      at: IsoDateTime;
    }
  | {
      kind: 'step_transition';
      runId: ProviderRunId;
      fromStep: { ordinal: number; name: string };
      toStep: { ordinal: number; name: string };
      carryForwardContext: string;
      at: IsoDateTime;
    }
  | {
      kind: 'permission_request';
      runId: ProviderRunId;
      toolUseId: string;
      toolName: string;
      input: unknown;
      at: IsoDateTime;
    }
  | {
      kind: 'permission_decision';
      runId: ProviderRunId;
      toolUseId: string;
      decision: 'allow' | 'deny';
      ruleId: PermissionRuleId | null;
      decidedBy: 'engine' | 'user' | 'default';
      at: IsoDateTime;
    }
  | {
      kind: 'unknown_payload';
      runId: ProviderRunId;
      adapter: string;
      payloadType: string;
      raw: unknown;
      at: IsoDateTime;
    };

export interface ProviderAdapter {
  readonly id: ProviderName;
  readonly capabilities: ProviderCapabilities;
  detect(): Promise<DetectResult>;
  spawn(request: TurnRequest): AsyncIterable<TurnEvent>;
  cost(usage: ProviderUsage, model: string): number;
}
