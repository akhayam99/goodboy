import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { overviewFullSeed } from '../overviewFullSeed';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

const NOW: IsoDateTime = JSON.parse(JSON.stringify('2026-11-10T09:00:00.000Z'));

export const seedArtifactDetail = ({ sessionId, workspaceId }: Params): void => {
  const seeded = overviewFullSeed({ workspaceId, sessionId, now: NOW });
  const artifacts = seeded.sessionArtifacts[sessionId] ?? [];
  const report = artifacts.find((artifact) => artifact.kind === 'report');
  if (report === undefined) {
    return;
  }
  useAppStore.setState((state) => ({
    sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
    loadSessionArtifacts: async () => undefined,
  }));
  useAppStore.getState().setFocusedArtifactId(sessionId, report.id);
  useAppStore.getState().openDrawer({
    kind: 'artifact',
    sessionId,
    payload: { artifactId: report.id, tab: 'details' },
  });
};
