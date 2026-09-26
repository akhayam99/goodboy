import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectAlsoOnBranchSessionId } from '../../../../../store/slices/project-mounts/selectors';
import { AlsoInChipContent } from './AlsoInChipContent';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

export const AlsoInChip = ({ sessionId, projectId, branch }: Props) => {
  const otherSessionId = useAppStore((state) =>
    selectAlsoOnBranchSessionId({ state, sessionId, projectId, branch }),
  );
  const otherSession = useAppStore((state) =>
    otherSessionId === null
      ? null
      : (state.sessions.find((candidate) => candidate.id === otherSessionId) ?? null),
  );

  if (otherSession === null) {
    return null;
  }

  return <AlsoInChipContent session={otherSession} />;
};
