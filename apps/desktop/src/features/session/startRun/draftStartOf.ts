import type { Session } from '@goodboy/types';
import type { IssueCandidate } from '../../integrations/fetchIssueCandidates';
import type {
  SessionDraftMount,
  SessionDraftStart,
} from '../../../store/slices/sessionDraft/startSessionFromDraft';

type Params = {
  readonly picked: ReadonlyArray<IssueCandidate>;
  readonly mount: SessionDraftMount | null;
  readonly ask: string;
  readonly run: (session: Session) => Promise<void>;
};

export const draftStartOf = ({ picked, mount, ask, run }: Params): SessionDraftStart => {
  const [firstTask] = picked;
  if (firstTask === undefined) {
    return { kind: 'workflow-run', goal: ask, run };
  }
  return {
    kind: 'task',
    candidates: picked,
    ...(mount !== null && { mount }),
    title: firstTask.title,
    goal: ask,
    then: { kind: 'workflow-run', run },
  };
};
