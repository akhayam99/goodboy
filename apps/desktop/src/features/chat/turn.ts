import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  parseStreamJsonLine,
  parseCursorStreamLine,
  parseCodexJsonLine,
  parseGeminiJsonLine,
  type ParseContext,
} from '@goodboy/core';
import type { IsoDateTime, ProviderId, ProviderRunId, TurnEvent } from '@goodboy/types';

// Each provider emits its own stream-json schema; the wrong parser silently
// returns zero events and the store reports "provider exited without a response".
function parseForProvider(
  provider: ProviderId,
  line: string,
  ctx: ParseContext,
): ReadonlyArray<TurnEvent> {
  switch (provider) {
    case 'anthropic':
      return parseStreamJsonLine(line, ctx);
    case 'cursor':
      return parseCursorStreamLine(line, ctx);
    case 'codex':
      return parseCodexJsonLine(line, ctx);
    case 'gemini':
      return parseGeminiJsonLine(line, ctx);
    default: {
      const _exhaustive: never = provider;
      void _exhaustive;
      return parseStreamJsonLine(line, ctx);
    }
  }
}

const AUTH_REQUIRED_PREFIX = '__auth_required__:';

export type AuthRequiredPayload = {
  readonly providerId: ProviderId;
  readonly identity: string | null;
};

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

type ClaudePermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';

type SpawnArgs = {
  readonly runId: ProviderRunId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly workingDir: string;
  readonly prompt: string;
  readonly binary?: string;
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
  readonly permissionMode?: ClaudePermissionMode;
  readonly resumeSessionId?: string;
  readonly systemPrompt?: string;
  readonly effort?: string;
  readonly apiKeyEnv?: string;
  readonly credentialId?: string;
};

type RawTurnEnvelope =
  | { runId: string; type: 'line'; line: string }
  | { runId: string; type: 'end'; exit_code: number | null; stderr: string }
  | { runId: string; type: 'error'; message: string };

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

  let receivedAnyLine = false;

  const unlisten: UnlistenFn = await listen<RawTurnEnvelope>(EVENT_NAME, (event) => {
    if (event.payload.runId !== args.runId) return;

    switch (event.payload.type) {
      case 'line':
        receivedAnyLine = true;
        for (const ev of parseForProvider(args.provider, event.payload.line, ctx)) {
          queue.push(ev);
        }
        flush();
        break;
      case 'end': {
        const exitCode = event.payload.exit_code;
        const stderr = event.payload.stderr;
        // Only synthesize an error when the process produced no JSON. If lines
        // were emitted the parsed events already convey the outcome; a second
        // "exit N" card would just be noise.
        if (!receivedAnyLine) {
          const tail = stderr.trim().split('\n').slice(-5).join('\n');
          const detail = tail.length > 0 ? `: ${tail}` : '';
          if (exitCode !== null && exitCode !== 0) {
            error = new Error(`provider exited with code ${exitCode}${detail}`);
          } else if (tail.length > 0) {
            error = new Error(`provider emitted no events${detail}`);
          }
        }
        ended = true;
        flush();
        break;
      }
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

export async function listLiveRunIds(): Promise<ReadonlySet<string>> {
  try {
    const ids = await invoke<string[]>('turn_list_live');
    return new Set(ids ?? []);
  } catch {
    return new Set();
  }
}

/**
 * Persists a composer image into `<worktree>/.goodboy/attachments/` and returns
 * the worktree-relative path the spawned provider CLI reads it from.
 */
export async function writeAttachment(args: {
  readonly worktreeDir: string;
  readonly attachmentId: string;
  readonly fileName: string;
  readonly dataBase64: string;
}): Promise<string> {
  return invoke<string>('attachment_write', args);
}

/** Reads a stored attachment back as a `data:` URL for display in the webview. */
export async function readAttachment(worktreeDir: string, relPath: string): Promise<string> {
  return invoke<string>('attachment_read', { worktreeDir, relPath });
}

export type DroppedAttachment = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataBase64: string;
};

/**
 * Reads a file path the user dropped onto the composer from the OS and returns
 * its bytes as base64. Image-only on the Rust side; non-image drops surface as
 * an `UnsupportedMime` error which the caller filters silently.
 */
export async function readDroppedAttachment(absPath: string): Promise<DroppedAttachment> {
  return invoke<DroppedAttachment>('attachment_read_dropped', { absPath });
}

type ParallelRunSpec = {
  readonly runId: ProviderRunId;
  readonly workingDir: string;
  readonly parallelIndex: number;
};

export type ParallelSpawnArgs = {
  readonly groupId: string;
  readonly runs: ReadonlyArray<ParallelRunSpec>;
  readonly binary?: string;
  readonly model: string;
  readonly prompt: string;
  readonly permissionMode?: ClaudePermissionMode;
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
  readonly apiKeyEnv?: string;
  readonly credentialId?: string;
};

/**
 * Spawn N child processes concurrently via a single Tauri invoke.
 *
 * Returns the launched `runId`s in the same order as `args.runs`.
 * Each run emits `turn_event` envelopes tagged with its own `runId`, the
 * existing `RawTurnEnvelope` listener already filters by `runId`, so no
 * frontend changes are needed for multiplexing.
 */
export async function invokeParallelPhaseRunSpawn(
  args: ParallelSpawnArgs,
): Promise<ReadonlyArray<ProviderRunId>> {
  return invoke<string[]>('parallel_agent_spawn', { args }).then((ids) => ids as ProviderRunId[]);
}
