import type { ProjectId } from '@goodboy/types';
import type { ProjectPick } from './projectAnswerOf';

export type ProjectCandidate = ProjectPick &
  Readonly<{
    projectId: ProjectId;
    line: string;
    isMounted: boolean;
  }>;
