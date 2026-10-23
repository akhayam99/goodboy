import type { WorkspaceId } from '@goodboy/types';
import { StartRun } from '../../../../../../features/session/components/StartRun/StartRun';
import { KickoffProjects } from '../../../../../../features/session/components/SessionKickoff/KickoffProjects';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const StartPageOneField = ({ workspaceId }: Props) => (
  <section aria-label="Kickoff" className="flex flex-col gap-6" data-start-page-era="0.27.11">
    <KickoffProjects workspaceId={workspaceId} />
    <StartRun workspaceId={workspaceId} sessionId={null} />
  </section>
);
