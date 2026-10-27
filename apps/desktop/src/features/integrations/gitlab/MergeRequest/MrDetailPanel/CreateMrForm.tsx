import { useCallback } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { useToast } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import { CreateReviewForm } from '../../../components/CreateReviewForm/CreateReviewForm';
import type {
  CreatedReview,
  CreateReviewInput,
  CreateReviewNouns,
} from '../../../components/CreateReviewForm/types';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly defaultTitle?: string;
  readonly defaultBody?: string;
  readonly onCreated: (created: CreatedReview) => void;
};

const NOUNS: CreateReviewNouns = {
  long: 'merge request',
  create: 'Create merge request',
  createDraft: 'Create draft merge request',
};

const NO_REQUESTS = async (): Promise<void> => undefined;

export const CreateMrForm = ({
  sessionId,
  mountId = null,
  defaultTitle,
  defaultBody = '',
  onCreated,
}: Props) => {
  const createMrForSession = useAppStore((state) => state.createMrForSession);
  const { showToast } = useToast();
  const goal = useAppStore((state) => sessionById(state.sessions, sessionId)?.goal ?? '');

  const create = useCallback(
    async ({ title, body, base, isDraft }: CreateReviewInput): Promise<CreatedReview> => {
      const created = await createMrForSession({
        sessionId,
        ...(mountId === null ? {} : { mountId }),
        title: title.trim(),
        description: body,
        targetBranch: base,
        draft: isDraft,
      });
      showToast({ kind: 'success', message: 'Merge request opened' });
      return created;
    },
    [createMrForSession, mountId, sessionId, showToast],
  );

  return (
    <CreateReviewForm
      sessionId={sessionId}
      mountId={mountId}
      defaultTitle={defaultTitle ?? goal}
      defaultBody={defaultBody}
      nouns={NOUNS}
      canSetDraft={REVIEW_SOURCE_CAPABILITIES.gitlab.canSetDraft}
      loadBases={null}
      searchReviewers={null}
      hasPushStep={false}
      hasCloses={false}
      create={create}
      requestReviewers={NO_REQUESTS}
      onCreated={onCreated}
    />
  );
};
