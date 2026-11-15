import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LEAD_PERMISSION_KEYS,
  LEAD_PERMISSION_PRESETS,
  type AutoLevel,
  type LeadPermissionKey,
  type LeadPermissions,
} from '@goodboy/core/auto';
import { formatError } from '@goodboy/ui';
import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { permissionChangeOf } from '../../permissions/permissionChangeOf';

export type LeadPermissionScope = 'lead' | 'default';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly treeId: AutoTreeId | null;
  readonly scope: LeadPermissionScope;
};

type KeyParams = {
  readonly key: LeadPermissionKey;
};

type ChangeParams = KeyParams & {
  readonly value: string | null;
};

type PresetParams = {
  readonly level: AutoLevel;
};

type TargetParams = {
  readonly treeId: AutoTreeId | null;
  readonly workspaceId: WorkspaceId;
};

export type LeadPermissionsModel = Readonly<{
  permissions: LeadPermissions | null;
  rowErrors: Readonly<Partial<Record<LeadPermissionKey, string>>>;
  presetError: string | null;
  readError: string | null;
  isBusy: boolean;
  change: (params: ChangeParams) => Promise<void>;
  reset: (params: KeyParams) => Promise<void>;
  pickPreset: (params: PresetParams) => Promise<void>;
}>;

const READ_KEY = 'lead-permissions-read';

const permissionTargetOf = ({ treeId, workspaceId }: TargetParams) =>
  treeId === null ? { workspaceId } : { treeId };

export const useLeadPermissions = ({
  workspaceId,
  sessionId,
  treeId: leadTreeId,
  scope,
}: Params): LeadPermissionsModel => {
  const isWorkFlowOn = useIsWorkOn();
  const readPermissions = useAppStore((state) => state.readLeadPermissions);
  const changePermission = useAppStore((state) => state.changeLeadPermission);
  const changeAutoLevel = useAppStore((state) => state.changeAutoLevel);
  const [permissions, setPermissions] = useState<LeadPermissions | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<LeadPermissionKey, string>>>({});
  const [presetError, setPresetError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const latestRef = useRef(createLatestOnly());
  const treeId = scope === 'lead' ? leadTreeId : null;
  const isLead = treeId !== null;

  const read = useCallback(async (): Promise<LeadPermissions | null> => {
    const claim = latestRef.current.claim({ key: READ_KEY });
    try {
      const value = await readPermissions({
        target: permissionTargetOf({ treeId, workspaceId }),
        isWorkFlowOn,
      });
      if (claim.isCurrent()) {
        setPermissions(value);
        setReadError(null);
      }
      return value;
    } catch (failure) {
      if (claim.isCurrent()) {
        setReadError(`Couldn't read the permissions. ${formatError(failure)}`);
      }
      return null;
    }
  }, [readPermissions, isWorkFlowOn, treeId, workspaceId]);

  useEffect(() => {
    setRowErrors({});
    setPresetError(null);
    setPermissions(null);
    void read();
    const latest = latestRef.current;
    return () => latest.cancel({ key: READ_KEY });
  }, [read]);

  const change = useCallback(
    async ({ key, value }: ChangeParams): Promise<void> => {
      const next = permissionChangeOf({ key, value });
      if (next === null) {
        return;
      }
      setRowErrors((held) => ({ ...held, [key]: undefined }));
      try {
        await changePermission({
          target: permissionTargetOf({ treeId, workspaceId }),
          change: next,
        });
      } catch (failure) {
        setRowErrors((held) => ({ ...held, [key]: `Couldn't change it. ${formatError(failure)}` }));
      }
      await read();
    },
    [changePermission, read, treeId, workspaceId],
  );

  const reset = useCallback(
    ({ key }: KeyParams): Promise<void> => change({ key, value: null }),
    [change],
  );

  const pickPreset = useCallback(
    async ({ level }: PresetParams): Promise<void> => {
      const target = permissionTargetOf({ treeId, workspaceId });
      const ownSource = isLead ? 'lead' : 'default';
      setPresetError(null);
      setIsBusy(true);
      try {
        await changeAutoLevel({ workspaceId, sessionId: isLead ? sessionId : null, level });
        for (const key of LEAD_PERMISSION_KEYS) {
          const cleared = permissionChangeOf({ key, value: null });
          if (cleared !== null && permissions?.rows[key].source === ownSource) {
            await changePermission({ target, change: cleared });
          }
        }
        const fresh = await read();
        if (isLead && fresh !== null) {
          for (const key of LEAD_PERMISSION_KEYS) {
            const wanted = LEAD_PERMISSION_PRESETS[level][key];
            const pin = permissionChangeOf({ key, value: wanted });
            if (pin !== null && fresh.rows[key].value !== wanted) {
              await changePermission({ target, change: pin });
            }
          }
          await read();
        }
      } catch (failure) {
        setPresetError(`Couldn't change it. ${formatError(failure)}`);
        await read();
      } finally {
        setIsBusy(false);
      }
    },
    [changeAutoLevel, changePermission, read, permissions, isLead, treeId, sessionId, workspaceId],
  );

  return { permissions, rowErrors, presetError, readError, isBusy, change, reset, pickPreset };
};
