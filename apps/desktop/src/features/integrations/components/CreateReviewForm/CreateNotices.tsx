import type { MountId, SessionId } from '@goodboy/types';
import { PushFixStatus } from '../../../../shared/components/PushFixStatus';
import { StaleDepsNotice } from '../../../../shared/components/StaleDepsNotice';
import type { PushFixFollowUp } from '../../../../store/slices/history/types';
import { CreateFailureNotice } from './CreateFailureNotice';
import type { CreateReviewNouns } from './types';

type Draft = {
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly isDraft: boolean;
};

type Failure = {
  readonly error: unknown;
};

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly hasPushStep: boolean;
  readonly nouns: CreateReviewNouns;
  readonly failure: Failure | null;
  readonly draft: Draft;
  readonly onRetry: () => Promise<PushFixFollowUp | undefined>;
};

export const CreateNotices = ({
  sessionId,
  mountId,
  hasPushStep,
  nouns,
  failure,
  draft,
  onRetry,
}: Props) => {
  if (failure !== null) {
    return (
      <CreateFailureNotice
        sessionId={sessionId}
        nouns={nouns}
        error={failure.error}
        draft={draft}
        onRetry={onRetry}
      />
    );
  }
  if (mountId === null) {
    return null;
  }
  return (
    <>
      {hasPushStep && <StaleDepsNotice sessionId={sessionId} mountId={mountId} />}
      <PushFixStatus sessionId={sessionId} mountId={mountId} />
    </>
  );
};
