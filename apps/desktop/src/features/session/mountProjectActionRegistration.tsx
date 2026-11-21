import type { SessionId, WorkspaceId } from '@goodboy/types';
import { MountProjectAction } from './components/SessionOverviewPane/ProjectMountRows/MountProjectAction';

type RenderParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const mountProjectActionRegistration = {
  render: ({ sessionId, workspaceId }: RenderParams) => (
    <MountProjectAction sessionId={sessionId} workspaceId={workspaceId} presentation="button" />
  ),
};
