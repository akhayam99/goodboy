import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { useLaunchMount } from '../../../inbox/useLaunchMount';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
  readonly projectId: ProjectId | null;
};

export const CrossProjectNote = ({ workspaceId, candidate, projectId }: Props) => {
  const mount = useLaunchMount({
    workspaceId,
    source: {
      provider: candidate.provider,
      url: candidate.url,
      sentryProject: candidate.sentryProject ?? null,
    },
  });
  const home = mount?.options[0];
  if (
    projectId === null ||
    home === undefined ||
    mount === null ||
    mount.options.some((option) => option.projectId === projectId)
  ) {
    return null;
  }
  return (
    <p role="status" className="px-2 text-meta text-faint-foreground">
      {candidate.identifier} belongs to {home.name}. It links to the session and can be put on a
      branch there later.
    </p>
  );
};
