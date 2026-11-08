import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PortRow } from '@goodboy/core/monitoring';
import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOwnedMounts } from '../../../../store/slices/monitoring/selectOwnedMounts';
import { runTitleOf } from '../../../../store/slices/navigation/runTitleOf';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { agentDisplayName } from '../../../../shared/utils/agentDisplayName';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { branchHomeOf } from '../../branchHomeOf';
import { ownerChainOf, type OwnerLink } from '../../ownerChainOf';
import { portMountOf } from '../../portMountOf';

type Params = {
  readonly row: PortRow;
};

type OwnerIds = {
  readonly sessionId: SessionId | null;
  readonly agentId: string | null;
  readonly runId: string | null;
  readonly spawnId: string | null;
};

const NO_IDS: OwnerIds = { sessionId: null, agentId: null, runId: null, spawnId: null };

const ownerIdsOf = ({ row }: Params): OwnerIds => {
  const { owner } = row;
  if (owner === null || owner.kind === 'external' || owner.kind === 'project') {
    return NO_IDS;
  }
  const sessionId =
    owner.sessionId === null || owner.sessionId === ''
      ? null
      : brandId<SessionId>({ value: owner.sessionId });
  if (owner.kind === 'worktree') {
    return { ...NO_IDS, sessionId };
  }
  return {
    sessionId,
    agentId: owner.agentId ?? null,
    runId: owner.runId ?? null,
    spawnId: owner.spawnId,
  };
};

export const usePortOwnerChain = ({ row }: Params): ReadonlyArray<OwnerLink> => {
  const { sessionId, agentId, runId, spawnId } = ownerIdsOf({ row });
  const title = useAppStore((state) => {
    const session = sessionId === null ? undefined : sessionById(state.sessions, sessionId);
    return session === undefined ? null : sessionTitle({ session });
  });
  const agentName = useAppStore((state) => {
    if (sessionId === null || agentId === null) {
      return null;
    }
    const agent = state.sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId);
    return agent === undefined
      ? null
      : agentDisplayName({ name: agent.name, kind: agent.kind ?? '' });
  });
  const runTitle = useAppStore((state) =>
    sessionId === null || runId === null ? null : runTitleOf({ state, sessionId, runId }),
  );
  const place = useAppStore(
    useShallow((state) => {
      const entry =
        spawnId === null
          ? undefined
          : state.monitorLedger.find((candidate) => candidate.spawnId === spawnId);
      const mounts = selectOwnedMounts({ state });
      const mount = portMountOf({
        row,
        ledgerBySpawn: new Map(entry === undefined ? [] : [[entry.spawnId, entry]]),
        mounts,
      });
      const projectName = projectById(state.projects, mount?.projectId ?? null)?.name ?? null;
      return {
        branch: mount?.branch ?? null,
        mountPath:
          mount === null
            ? null
            : branchHomeOf({ mounts, mountId: mount.mountId, branch: mount.branch }),
        projectName,
      };
    }),
  );

  return useMemo(() => {
    if (row.owner === null) {
      return [];
    }
    const branch =
      place.branch === null
        ? null
        : {
            name:
              place.projectName === null ? place.branch : `${place.projectName} · ${place.branch}`,
            mountPath: place.mountPath,
          };
    return ownerChainOf({ owner: row.owner, sessionTitle: title, agentName, runTitle, branch });
  }, [row.owner, title, agentName, runTitle, place.branch, place.mountPath, place.projectName]);
};
