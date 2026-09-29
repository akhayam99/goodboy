import { invokeCommand } from '../../shared/lib/invokeCommand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { createJsonLineAssembler, type ParseContext } from '@goodboy/core';
import {
  PROVIDER_IDS,
  type IsoDateTime,
  type ProviderId,
  type ProviderLimits,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { classifyProviderError } from './classifyProviderError';
import { parseProviderLine } from './parseProviderLine';
import { clearTurnCursor, writeTurnCursor, type TurnCursor, type TurnOwner } from './turnCursor';

const AUTH_REQUIRED_PREFIX = '__auth_required__:';

export type AuthRequiredPayload = {
  readonly providerId: ProviderId;
  readonly identity: string | null;
};

export const encodeAuthRequiredMessage = (payload: AuthRequiredPayload): string => {
  return `${AUTH_REQUIRED_PREFIX}${JSON.stringify(payload)}`;
};

export const decodeAuthRequiredMessage = (message: string): AuthRequiredPayload | null => {
  if (!message.startsWith(AUTH_REQUIRED_PREFIX)) {
    return null;
  }
  try {
    return JSON.parse(message.slice(AUTH_REQUIRED_PREFIX.length)) as AuthRequiredPayload;
  } catch {
    return null;
  }
};

const CLI_TOO_OLD_PREFIX = '__cli_too_old__:';

export type CliTooOldPayload = {
  readonly providerId: ProviderId;
  readonly modelKey: string | null;
  readonly installedVersion: string;
  readonly requiredVersion: string;
  readonly fallbackModelKey: string | null;
  readonly detail: string;
};

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isCliTooOldPayload = (value: unknown): value is CliTooOldPayload =>
  typeof value === 'object' &&
  value !== null &&
  PROVIDER_IDS.some((providerId) => providerId === Reflect.get(value, 'providerId')) &&
  isNullableString(Reflect.get(value, 'modelKey')) &&
  typeof Reflect.get(value, 'installedVersion') === 'string' &&
  typeof Reflect.get(value, 'requiredVersion') === 'string' &&
  isNullableString(Reflect.get(value, 'fallbackModelKey')) &&
  typeof Reflect.get(value, 'detail') === 'string';

export const encodeCliTooOldMessage = (payload: CliTooOldPayload): string =>
  `${CLI_TOO_OLD_PREFIX}${JSON.stringify(payload)}`;

export const decodeCliTooOldMessage = (message: string): CliTooOldPayload | null => {
  if (!message.startsWith(CLI_TOO_OLD_PREFIX)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(message.slice(CLI_TOO_OLD_PREFIX.length));
    return isCliTooOldPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const EVENT_NAME = 'turn_event';
const NO_RESPONSE_MESSAGE =
  'provider exited without a response. check that the CLI is configured correctly.';

type Params = {
  readonly line: string;
};

const isJsonProviderFrame = ({ line }: Params): boolean => {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
};

type ClaudePermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk' | 'plan';

type SpawnArgs = {
  readonly runId: ProviderRunId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly workingDir: string;
  readonly writableRoots: ReadonlyArray<string>;
  readonly prompt: string;
  readonly binary?: string;
  readonly allowedTools?: ReadonlyArray<string>;
  readonly disallowedTools?: ReadonlyArray<string>;
  readonly permissionMode?: ClaudePermissionMode;
  readonly resumeSessionId?: string;
  readonly systemPrompt?: string;
  readonly effort?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly mountId?: string;
  readonly apiKeyEnv?: string;
  readonly credentialId?: string;
  readonly cursorMaxMode?: boolean;
  readonly blocksPush?: boolean;
  readonly excludesTmp?: boolean;
  readonly writerLease?: {
    readonly path: string;
    readonly holder: string;
    readonly token: string;
  };
};

type RawTurnEnvelope =
  | { runId: string; seq?: number; type: 'line'; line: string }
  | { runId: string; seq?: number; type: 'end'; exit_code: number | null; stderr: string }
  | { runId: string; seq?: number; type: 'error'; message: string };

type WithoutRunId<T> = T extends unknown ? Omit<T, 'runId'> : never;

type TurnAttachSnapshot = {
  readonly events: ReadonlyArray<WithoutRunId<RawTurnEnvelope>>;
  readonly hasGap: boolean;
  readonly isLive: boolean;
};

export type RunTurnHooks = {
  readonly onProviderLimits?: (limits: ProviderLimits) => void;
  readonly owner?: TurnOwner;
};

export const RELOAD_GAP_MESSAGE =
  'Part of this output was written while the window reloaded and could not be recovered.';
export const RUN_GONE_MESSAGE = 'This run ended while the window reloaded.';

const activeStreams = new Set<string>();

export const isTurnStreamActive = ({ runId }: { readonly runId: ProviderRunId }): boolean =>
  activeStreams.has(runId);

type QueuedEvent = {
  readonly event: TurnEvent;
  readonly seq: number | null;
  readonly index: number;
};

type BeginParams = {
  readonly deliver: (envelopes: ReadonlyArray<RawTurnEnvelope>) => void;
  readonly note: (message: string) => void;
};

type StreamParams = {
  readonly runId: ProviderRunId;
  readonly provider: ProviderId;
  readonly now: () => IsoDateTime;
  readonly hooks: RunTurnHooks;
  readonly resumeFrom: TurnCursor | null;
  readonly begin: (params: BeginParams) => Promise<void>;
};

async function* streamTurn({
  runId,
  provider,
  now,
  hooks,
  resumeFrom,
  begin,
}: StreamParams): AsyncIterable<TurnEvent> {
  const ctx: ParseContext = {
    runId,
    now,
    ...(hooks.onProviderLimits !== undefined && { onProviderLimits: hooks.onProviderLimits }),
  };
  const owner = hooks.owner ?? null;
  const queue: QueuedEvent[] = [];
  let resolver: ((value: IteratorResult<QueuedEvent>) => void) | null = null;
  let rejector: ((err: unknown) => void) | null = null;
  let ended = false;
  let error: unknown = null;

  const flush = () => {
    if (!resolver) {
      return;
    }
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

  const isResumed = resumeFrom !== null && resumeFrom.seq > 0;
  let receivedAnyEvent = isResumed;
  let receivedResponseEvent = isResumed;
  const unparsedOutput: string[] = [];
  let lastSeq = resumeFrom === null ? 0 : resumeFrom.seq - 1;
  let currentSeq: number | null = null;
  let indexInSeq = 0;

  const assembler = createJsonLineAssembler();

  const push = ({ event }: { readonly event: TurnEvent }) => {
    const index = indexInSeq;
    indexInSeq += 1;
    const isAlreadyHandled =
      resumeFrom !== null && currentSeq === resumeFrom.seq && index <= resumeFrom.index;
    if (isAlreadyHandled) {
      return;
    }
    queue.push({ event, seq: currentSeq, index });
  };

  const handleLine = ({ line }: { readonly line: string }) => {
    const parsedEvents = parseProviderLine({ provider, line, ctx });
    if (parsedEvents.length > 0) {
      receivedAnyEvent = true;
    }
    if (parsedEvents.length === 0 && line.trim() !== '') {
      unparsedOutput.push(line.trim());
    }
    for (const ev of parsedEvents) {
      if (
        ev.kind === 'error' &&
        classifyProviderError({ message: ev.message }).kind === 'usage_limit'
      ) {
        receivedResponseEvent = true;
        error = new Error(ev.message);
        ended = true;
        break;
      }
      if (ev.kind === 'assistant_text' || ev.kind === 'done' || ev.kind === 'error') {
        receivedResponseEvent = true;
      }
      push({ event: ev });
    }
  };

  const handleEnvelope = (envelope: RawTurnEnvelope) => {
    if (envelope.seq !== undefined) {
      if (envelope.seq <= lastSeq) {
        return;
      }
      lastSeq = envelope.seq;
    }
    currentSeq = envelope.seq ?? null;
    indexInSeq = 0;
    switch (envelope.type) {
      case 'line': {
        const assembled = assembler.push({ line: envelope.line });
        switch (assembled.kind) {
          case 'line':
            handleLine({ line: assembled.line });
            break;
          case 'overflow':
            for (const line of assembled.lines) {
              handleLine({ line });
            }
            break;
          case 'pending':
            break;
          default: {
            const _exhaustive: never = assembled;
            void _exhaustive;
          }
        }
        flush();
        break;
      }
      case 'end': {
        for (const line of assembler.flush()) {
          handleLine({ line });
        }
        if (!receivedAnyEvent) {
          const stderrMessage = envelope.stderr.trim();
          const stdoutMessage = unparsedOutput
            .filter((line) => !isJsonProviderFrame({ line }))
            .join('\n');
          const hasFailedExit = envelope.exit_code !== null && envelope.exit_code !== 0;
          const stdoutClassification = classifyProviderError({ message: stdoutMessage });
          const providerMessage = [
            hasFailedExit || stdoutClassification.kind !== 'other' ? stdoutMessage : '',
            stderrMessage,
          ]
            .filter((value) => value !== '')
            .join('\n');
          error =
            providerMessage !== '' ? new Error(providerMessage) : new Error(NO_RESPONSE_MESSAGE);
        }
        if (
          receivedAnyEvent &&
          !receivedResponseEvent &&
          envelope.exit_code !== null &&
          envelope.exit_code !== 0
        ) {
          const stderrMessage = envelope.stderr.trim();
          const stdoutMessage = unparsedOutput
            .filter((line) => !isJsonProviderFrame({ line }))
            .join('\n');
          const providerMessage = [stdoutMessage, stderrMessage]
            .filter((value) => value !== '')
            .join('\n');
          error =
            providerMessage !== '' ? new Error(providerMessage) : new Error(NO_RESPONSE_MESSAGE);
        }
        ended = true;
        flush();
        break;
      }
      case 'error':
        error = new Error(envelope.message);
        ended = true;
        flush();
        break;
    }
  };

  let isHolding = true;
  const held: RawTurnEnvelope[] = [];
  const unlisten: UnlistenFn = await listen<RawTurnEnvelope>(EVENT_NAME, (event) => {
    if (event.payload.runId !== runId) {
      return;
    }
    if (isHolding) {
      held.push(event.payload);
      return;
    }
    handleEnvelope(event.payload);
  });

  const writeCursor = ({ seq, index }: { readonly seq: number; readonly index: number }) =>
    writeTurnCursor({ runId, cursor: { seq, index, owner } });

  writeCursor(resumeFrom ?? { seq: 0, index: -1 });
  activeStreams.add(runId);

  try {
    await begin({
      deliver: (envelopes) => {
        for (const envelope of envelopes) {
          handleEnvelope(envelope);
        }
      },
      note: (message) => {
        queue.push({
          event: { kind: 'decision_note', runId, message, at: now() },
          seq: null,
          index: 0,
        });
      },
    });
    isHolding = false;
    for (const envelope of held.splice(0)) {
      handleEnvelope(envelope);
    }
    flush();

    while (true) {
      const next =
        queue.length > 0
          ? queue.shift()!
          : ended
            ? null
            : await new Promise<IteratorResult<QueuedEvent>>((resolve, reject) => {
                resolver = resolve;
                rejector = reject;
              }).then((result) => (result.done === true ? null : result.value));
      if (next === null) {
        if (error) {
          throw error;
        }
        return;
      }
      yield next.event;
      if (next.seq !== null) {
        writeCursor({ seq: next.seq, index: next.index });
      }
    }
  } finally {
    activeStreams.delete(runId);
    unlisten();
    clearTurnCursor({ runId });
    if (!ended) {
      await invokeCommand('turn_cancel', { runId }).catch(() => undefined);
    }
    if (ended) {
      await invokeCommand('turn_release', { runId }).catch(() => undefined);
    }
  }
}

export const runTurn = (
  args: SpawnArgs,
  now: () => IsoDateTime = () => new Date().toISOString() as IsoDateTime,
  hooks: RunTurnHooks = {},
): AsyncIterable<TurnEvent> =>
  streamTurn({
    runId: args.runId,
    provider: args.provider,
    now,
    hooks,
    resumeFrom: null,
    begin: async () => {
      await invokeCommand<string>('turn_spawn', { args });
    },
  });

type AttachParams = {
  readonly runId: ProviderRunId;
  readonly provider: ProviderId;
  readonly cursor: TurnCursor;
  readonly now?: () => IsoDateTime;
  readonly hooks?: RunTurnHooks;
};

export const attachTurn = ({
  runId,
  provider,
  cursor,
  now = () => new Date().toISOString() as IsoDateTime,
  hooks = {},
}: AttachParams): AsyncIterable<TurnEvent> =>
  streamTurn({
    runId,
    provider,
    now,
    hooks: { ...hooks, ...(cursor.owner !== null && { owner: cursor.owner }) },
    resumeFrom: cursor,
    begin: async ({ deliver, note }) => {
      const snapshot = await invokeCommand<TurnAttachSnapshot | null>('turn_attach', {
        runId,
        afterSeq: Math.max(cursor.seq - 1, 0),
      });
      if (snapshot === null) {
        deliver([{ runId, type: 'error', message: RUN_GONE_MESSAGE }]);
        return;
      }
      if (snapshot.hasGap) {
        note(RELOAD_GAP_MESSAGE);
      }
      deliver(snapshot.events.map((event): RawTurnEnvelope => ({ ...event, runId })));
    },
  });

export const cancelTurn = async (runId: ProviderRunId): Promise<void> => {
  await invokeCommand('turn_cancel', { runId });
};

export const listLiveRunIds = async (): Promise<ReadonlySet<string>> => {
  try {
    const ids = await invokeCommand<string[]>('turn_list_live');
    return new Set(ids ?? []);
  } catch {
    return new Set();
  }
};

export const writeAttachment = async (args: {
  readonly worktreeDir: string;
  readonly attachmentId: string;
  readonly fileName: string;
  readonly dataBase64: string;
}): Promise<string> => {
  return invokeCommand<string>('attachment_write', args);
};

export const readAttachment = async (worktreeDir: string, relPath: string): Promise<string> => {
  return invokeCommand<string>('attachment_read', { worktreeDir, relPath });
};

export const deleteAttachment = async (worktreeDir: string, relPath: string): Promise<void> => {
  await invokeCommand('attachment_delete', { worktreeDir, relPath });
};
