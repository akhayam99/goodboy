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

type LevelParams = {
  readonly level: AutoLevel;
};

type TargetParams = {
  readonly treeId: AutoTreeId | null;
  readonly workspaceId: WorkspaceId;
};

export type LeadPermissionsModel = Readonly<{
  permissions: LeadPermissions | null;
  rowErrors: Readonly<Partial<Record<LeadPermissionKey, string>>>;
  levelError: string | null;
  readError: string | null;
  isBusy: boolean;
  change: (params: ChangeParams) => Promise<void>;
  pickLevel: (params: LevelParams) => Promise<void>;
  clearDetails: () => Promise<void>;
  reload: () => Promise<void>;
}>;

const READ_KEY = 'lead-permissions-read';

const permissionTargetOf = ({ treeId, workspaceId }: TargetParams) =>
  treeId === null ? { workspaceId } : { treeId };

type ReadTargetParams = TargetParams & {
  readonly levelSessionId: SessionId | null;
};

const readTargetOf = ({ treeId, workspaceId, levelSessionId }: ReadTargetParams) => {
  if (treeId === null && levelSessionId !== null) {
    return { sessionId: levelSessionId };
  }
  return permissionTargetOf({ treeId, workspaceId });
};

export const useLeadPermissions = ({
  workspaceId,
  sessionId,
  treeId: leadTreeId,
  scope,
}: Params): LeadPermissionsModel => {
  const readPermissions = useAppStore((state) => state.readLeadPermissions);
  const changePermission = useAppStore((state) => state.changeLeadPermission);
  const changeAutoLevel = useAppStore((state) => state.changeAutoLevel);
  const markChanged = useAppStore((state) => state.markLeadPermissionsChanged);
  const revision = useAppStore(
    (state) => state.leadPermissionsRevisionByWorkspace[workspaceId] ?? 0,
  );
  const seenRevisionRef = useRef(revision);
  const [permissions, setPermissions] = useState<LeadPermissions | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<LeadPermissionKey, string>>>({});
  const [levelError, setLevelError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const latestRef = useRef(createLatestOnly());
  const treeId = scope === 'lead' ? leadTreeId : null;
  const isLead = treeId !== null;
  const levelSessionId = isLead || leadTreeId === null ? sessionId : null;

  const read = useCallback(async (): Promise<LeadPermissions | null> => {
    const claim = latestRef.current.claim({ key: READ_KEY });
    try {
      const value = await readPermissions({
        target: readTargetOf({ treeId, workspaceId, levelSessionId }),
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
  }, [readPermissions, treeId, workspaceId, levelSessionId]);

  useEffect(() => {
    setRowErrors({});
    setLevelError(null);
    setPermissions(null);
    void read();
    const latest = latestRef.current;
    return () => latest.cancel({ key: READ_KEY });
  }, [read]);

  useEffect(() => {
    if (seenRevisionRef.current === revision) {
      return;
    }
    seenRevisionRef.current = revision;
    void read();
  }, [read, revision]);

  const announce = useCallback((): void => {
    seenRevisionRef.current = markChanged({ workspaceId });
  }, [markChanged, workspaceId]);

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
        announce();
      } catch (failure) {
        setRowErrors((held) => ({ ...held, [key]: `Couldn't change it. ${formatError(failure)}` }));
      }
      await read();
    },
    [announce, changePermission, read, treeId, workspaceId],
  );

  const reload = useCallback(async (): Promise<void> => {
    await read();
  }, [read]);

  const clearDetails = useCallback(async (): Promise<void> => {
    const target = permissionTargetOf({ treeId, workspaceId });
    const ownSource = isLead ? 'lead' : 'default';
    let hasWritten = false;
    setLevelError(null);
    setIsBusy(true);
    try {
      for (const key of LEAD_PERMISSION_KEYS) {
        const cleared = permissionChangeOf({ key, value: null });
        if (cleared !== null && permissions?.rows[key].source === ownSource) {
          await changePermission({ target, change: cleared });
          hasWritten = true;
        }
      }
    } catch (failure) {
      setLevelError(`Couldn't reset the details. ${formatError(failure)}`);
    } finally {
      if (hasWritten) {
        announce();
      }
      await read();
      setIsBusy(false);
    }
  }, [announce, changePermission, read, permissions, isLead, treeId, workspaceId]);

  const pickLevel = useCallback(
    async ({ level }: LevelParams): Promise<void> => {
      const target = permissionTargetOf({ treeId, workspaceId });
      const ownSource = isLead ? 'lead' : 'default';
      const isSessionLevel = !isLead && levelSessionId !== null;
      let hasWritten = false;
      setLevelError(null);
      setIsBusy(true);
      try {
        await changeAutoLevel({ workspaceId, sessionId: levelSessionId, level });
        hasWritten = true;
        for (const key of isSessionLevel ? [] : LEAD_PERMISSION_KEYS) {
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
        setLevelError(`Couldn't change it. ${formatError(failure)}`);
        await read();
      } finally {
        if (hasWritten) {
          announce();
        }
        setIsBusy(false);
      }
    },
    [
      announce,
      changeAutoLevel,
      changePermission,
      read,
      permissions,
      isLead,
      treeId,
      levelSessionId,
      workspaceId,
    ],
  );

  return {
    permissions,
    rowErrors,
    levelError,
    readError,
    isBusy,
    change,
    pickLevel,
    clearDetails,
    reload,
  };
};
