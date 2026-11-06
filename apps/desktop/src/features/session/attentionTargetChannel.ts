import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  brandId,
  type AgentId,
  type MountId,
  type SessionAttentionReason,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { isTauriRuntime } from '../../shared/lib/isTauriRuntime';
import type { AttentionExactPlace, AttentionTarget } from './attentionTarget';
import type { NotificationPlaceReason } from './notificationPlaceReason';
import { ATTENTION_REASON_META } from './session-stage';

const TARGET_EVENT = 'goodboy:attention-target';
const PENDING_KEY = 'goodboy:attention-target';
const PENDING_TTL_MS = 30_000;
const PLACE_ONLY_REASONS = ['pr-opened', 'history-stopped'] as const;

type Pending = Readonly<{
  target: AttentionTarget;
  at: number;
}>;

type TargetParams = {
  readonly target: AttentionTarget;
};

type ListenParams = {
  readonly onTarget: (params: TargetParams) => void;
};

type TakeParams = {
  readonly workspaceId: string;
  readonly now: number;
};

type ValueParams = {
  readonly value: unknown;
};

const filledTextOf = ({ value }: ValueParams): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

const attentionReasonOf = ({ value }: ValueParams): SessionAttentionReason | null =>
  Object.keys(ATTENTION_REASON_META).find((key): key is SessionAttentionReason => key === value) ??
  null;

const placeReasonOf = ({ value }: ValueParams): NotificationPlaceReason | null =>
  attentionReasonOf({ value }) ?? PLACE_ONLY_REASONS.find((reason) => reason === value) ?? null;

const storedPlaceOf = ({ value }: ValueParams): AttentionExactPlace | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const reason = 'reason' in value ? placeReasonOf({ value: value.reason }) : null;
  if (reason === null) {
    return null;
  }
  const mountId = 'mountId' in value ? filledTextOf({ value: value.mountId }) : null;
  const subject = 'subject' in value ? value.subject : null;
  return {
    reason,
    mountId: mountId === null ? null : brandId<MountId>({ value: mountId }),
    ...(subject === 'note' || subject === 'comment' ? { subject } : {}),
  };
};

const storedTargetOf = ({ value }: ValueParams): AttentionTarget | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const sessionId = 'sessionId' in value ? filledTextOf({ value: value.sessionId }) : null;
  if (sessionId === null) {
    return null;
  }
  const workspaceId = 'workspaceId' in value ? filledTextOf({ value: value.workspaceId }) : null;
  const agentId = 'agentId' in value ? filledTextOf({ value: value.agentId }) : null;
  const place = 'place' in value ? storedPlaceOf({ value: value.place }) : null;
  return {
    workspaceId: workspaceId === null ? null : brandId<WorkspaceId>({ value: workspaceId }),
    sessionId: brandId<SessionId>({ value: sessionId }),
    reason: 'reason' in value ? attentionReasonOf({ value: value.reason }) : null,
    agentId: agentId === null ? null : brandId<AgentId>({ value: agentId }),
    ...(place === null ? {} : { place }),
  };
};

const pendingTargetOf = ({ value }: ValueParams): Pending | null => {
  if (typeof value !== 'object' || value === null || !('target' in value) || !('at' in value)) {
    return null;
  }
  const target = storedTargetOf({ value: value.target });
  return target === null || typeof value.at !== 'number' ? null : { target, at: value.at };
};

const readPending = (): Pending | null => {
  try {
    const raw = globalThis.localStorage?.getItem(PENDING_KEY) ?? null;
    if (raw === null) {
      return null;
    }
    return pendingTargetOf({ value: JSON.parse(raw) });
  } catch {
    return null;
  }
};

const clearPending = (): void => {
  try {
    globalThis.localStorage?.removeItem(PENDING_KEY);
  } catch {
    return;
  }
};

export const attentionTargetChannel = {
  send: async ({ target }: TargetParams): Promise<void> => {
    try {
      globalThis.localStorage?.setItem(
        PENDING_KEY,
        JSON.stringify({ target, at: Date.now() } satisfies Pending),
      );
    } catch {
      clearPending();
    }
    if (!isTauriRuntime()) {
      return;
    }
    await emit(TARGET_EVENT, target);
  },
  take: ({ workspaceId, now }: TakeParams): AttentionTarget | null => {
    const pending = readPending();
    if (pending === null || pending.target.workspaceId !== workspaceId) {
      return null;
    }
    clearPending();
    return now - pending.at <= PENDING_TTL_MS ? pending.target : null;
  },
  listen: async ({ onTarget }: ListenParams): Promise<UnlistenFn> => {
    if (!isTauriRuntime()) {
      return () => undefined;
    }
    return listen<unknown>(TARGET_EVENT, (event) => {
      const target = storedTargetOf({ value: event.payload });
      if (target !== null) {
        onTarget({ target });
      }
    });
  },
};
