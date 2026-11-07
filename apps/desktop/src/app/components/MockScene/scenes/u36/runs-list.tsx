import type { ComponentType } from 'react';
import { useAppStore } from '../../../../../store';
import { C08_SESSION_ID } from '../u25/c08RunSeed';
import { C08RunScene } from '../u25/C08RunScene';
import { seedRunsByBranch, seedRunsByState, seedRunsEmpty } from './runsListSeed';

const openDrawerBesideList = (): void => {
  seedRunsByBranch();
  useAppStore.getState().openDrawer({ kind: 'spawned', sessionId: C08_SESSION_ID, payload: null });
};

export const U36_RUNS_LIST_SCENES = {
  'u36-p14-runs-by-branch': () => (
    <C08RunScene state="working" selection="list" extra={seedRunsByBranch} />
  ),
  'u36-p14-runs-by-state': () => (
    <C08RunScene state="working" selection="list" extra={seedRunsByState} />
  ),
  'u36-p14-runs-start-open': () => (
    <C08RunScene state="working" selection="list" click="startRun" extra={seedRunsByState} />
  ),
  'u36-p14-runs-empty': () => (
    <C08RunScene state="working" selection="list" extra={seedRunsEmpty} />
  ),
  'u36-p14-runs-drawer-open': () => (
    <C08RunScene state="working" selection="list" extra={openDrawerBesideList} />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
