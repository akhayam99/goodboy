import { onAction } from '@tauri-apps/plugin-notification';
import {
  brandId,
  type SessionAttentionReason,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { isTauriRuntime } from '../../../shared/lib/isTauriRuntime';

export type BannerTap = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly reason: SessionAttentionReason | null;
};

type TapParams = {
  readonly tap: BannerTap;
};

type Params = {
  readonly onTap: (params: TapParams) => void;
};

type ValueParams = {
  readonly value: unknown;
};

const reasonOf = ({ value }: ValueParams): SessionAttentionReason | null =>
  Object.keys(ATTENTION_REASON_META).find((key): key is SessionAttentionReason => key === value) ??
  null;

const stringOrNull = ({ value }: ValueParams): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

export const listenBannerTaps = async ({ onTap }: Params): Promise<() => void> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const listener = await onAction((event) => {
    if (event.actionId !== 'tap') {
      return;
    }
    const extra = event.notification?.extra;
    const workspaceId = stringOrNull({ value: extra?.workspaceId });
    if (workspaceId === null) {
      return;
    }
    const sessionId = stringOrNull({ value: extra?.sessionId });
    onTap({
      tap: {
        workspaceId: brandId<WorkspaceId>({ value: workspaceId }),
        sessionId: sessionId === null ? null : brandId<SessionId>({ value: sessionId }),
        reason: reasonOf({ value: extra?.reason }),
      },
    });
  });
  return () => {
    void listener.unregister();
  };
};
