import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { parseStreamJsonLine } from '@kay-am/core';
import type { IsoDateTime, ProviderId, ProviderRunId, TurnEvent } from '@kay-am/types';

export const AUTH_REQUIRED_PREFIX = '__auth_required__:';

export interface AuthRequiredPayload {
  readonly providerId: ProviderId;
  readonly identity: string | null;
}

export function encodeAuthRequiredMessage(payload: AuthRequiredPayload): string {
  return `${AUTH_REQUIRED_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeAuthRequiredMessage(message: string): AuthRequiredPayload | null {
  if (!message.startsWith(AUTH_REQUIRED_PREFIX)) return null;
  try {
    return JSON.parse(message.slice(AUTH_REQUIRED_PREFIX.length)) as AuthRequiredPayload;
  } catch {
    return null;
  }
}

const AUTH_ERROR_PATTERNS = [
  /not authenticated/i,
  /not logged in/i,
  /auth required/i,
  /authentication required/i,
  /please log in/i,
  /please sign in/i,
  /unauthenticated/i,
  /401/,
  /unauthorized/i,
  /login required/i,
  /not signed in/i,
];

export function isAuthErrorMessage(text: string): boolean {
  return AUTH_ERROR_PATTERNS.some((p) => p.test(text));
}

const EVENT_NAME = 'turn_event';

export type ClaudePermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'plan';

interface SpawnArgs {
  readonly runId: ProviderRunId;
  readonly model: string;
  readonly workingDir: string;
  readonly prompt: string;
  readonly binary?: string;
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
  readonly permissionMode?: ClaudePermissionMode;
}

type RawTurnEnvelope =
  | { runId: string; type: 'line'; line: string }
  | { runId: string; type: 'end'; exit_code: number | null; stderr: string }
  | { runId: string; type: 'error'; message: string };

export interface TurnTermination {
  readonly exitCode: number | null;
  readonly stderr: string;
}

export async function* runTurn(
  args: SpawnArgs,
  now: () => IsoDateTime = () => new Date().toISOString() as IsoDateTime,
): AsyncIterable<TurnEvent> {
  const ctx = { runId: args.runId, now };
  const queue: TurnEvent[] = [];
  let resolver: ((value: IteratorResult<TurnEvent>) => void) | null = null;
  let rejector: ((err: unknown) => void) | null = null;
  let ended = false;
  let error: unknown = null;

  const flush = () => {
    if (!resolver) return;
    if (queue.length > 0) {
      const value = queue.shift()!;
      const r = resolver;
      resolver = null;
      r({ value, done: false });
      return;
    }
    if (ended) {
      const r = resolver;
      resolver = null;
      if (error) {
        const rej = rejector;
        rejector = null;
        rej?.(error);
      } else {
        r({ value: undefined, done: true });
      }
    }
  };

  const unlisten: UnlistenFn = await listen<RawTurnEnvelope>(EVENT_NAME, (event) => {
    if (event.payload.runId !== args.runId) return;

    switch (event.payload.type) {
      case 'line':
        for (const ev of parseStreamJsonLine(event.payload.line, ctx)) {
          queue.push(ev);
        }
        flush();
        break;
      case 'end':
        ended = true;
        flush();
        break;
      case 'error':
        error = new Error(event.payload.message);
        ended = true;
        flush();
        break;
    }
  });

  await invoke<string>('turn_spawn', { args });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (ended) {
        if (error) throw error;
        return;
      }
      const value = await new Promise<IteratorResult<TurnEvent>>((resolve, reject) => {
        resolver = resolve;
        rejector = reject;
      });
      if (value.done) return;
      yield value.value;
    }
  } finally {
    unlisten();
    if (!ended) {
      try {
        await invoke('turn_cancel', { runId: args.runId });
      } catch {
        // best-effort cancellation
      }
    }
  }
}

export async function cancelTurn(runId: ProviderRunId): Promise<void> {
  await invoke('turn_cancel', { runId });
}
