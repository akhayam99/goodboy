import { useCallback, useMemo } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { pullRequestPortFor } from '../../../../../store/slices/review-source/pullRequestPortFor';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { CreateReviewForm } from '../../../components/CreateReviewForm/CreateReviewForm';
import type {
  CreatedReview,
  CreateReviewInput,
  CreateReviewNouns,
  RequestReviewersParams,
  SearchReviewers,
} from '../../../components/CreateReviewForm/types';
import { ghBaseBranches } from '../../github';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly defaultTitle: string;
  readonly defaultBody?: string;
  readonly closedPr?: { readonly number: number; readonly url: string };
  readonly onCreated: (created: CreatedReview) => void;
};

const NOUNS: CreateReviewNouns = {
  long: 'pull request',
  create: 'Create pull request',
  createDraft: 'Create draft pull request',
};

export const CreatePrPanel = ({
  sessionId,
  mountId = null,
  defaultTitle,
  defaultBody,
  closedPr,
  onCreated,
}: Props) => {
  const createPrForSession = useAppStore((state) => state.createPrForSession);
  const requestReview = useAppStore((state) => state.requestReview);
  const repo = useSessionRepo({ sessionId });
  const workspaceId = useAppStore((state) => sessionById(state.sessions, sessionId)?.workspaceId);
  const projectRoot = repo?.repoRoot ?? null;
  const projectId = repo?.projectId;

  const loadBases = useMemo(
    () => (projectRoot === null ? null : () => ghBaseBranches(projectRoot, workspaceId, projectId)),
    [projectId, projectRoot, workspaceId],
  );

  const searchReviewers = useMemo<SearchReviewers | null>(() => {
    if (!REVIEW_SOURCE_CAPABILITIES.github.canRequestReviewers) {
      return null;
    }
    const port = pullRequestPortFor({
      get: useAppStore.getState,
      sessionId,
      ...(mountId === null ? {} : { mountId }),
      prNumber: 0,
    });
    return port === null ? null : (query) => port.searchReviewers({ query });
  }, [mountId, sessionId]);

  const create = useCallback(
    async ({ title, body, base, isDraft, isScribeBody, dismissed, onPushed }: CreateReviewInput) =>
      createPrForSession({
        sessionId,
        ...(mountId === null ? {} : { mountId }),
        title,
        body,
        base,
        draft: isDraft,
        isScribeBody,
        excludedIssues: dismissed,
        onPushed,
      }),
    [createPrForSession, mountId, sessionId],
  );

  const requestReviewers = useCallback(
    ({ sessionId: target, number, logins }: RequestReviewersParams) =>
      requestReview(target, number, logins),
    [requestReview],
  );

  return (
    <CreateReviewForm
      sessionId={sessionId}
      mountId={mountId}
      defaultTitle={defaultTitle}
      {...(defaultBody === undefined ? {} : { defaultBody })}
      {...(closedPr === undefined ? {} : { closedPr })}
      nouns={NOUNS}
      canSetDraft={REVIEW_SOURCE_CAPABILITIES.github.canSetDraft}
      loadBases={loadBases}
      searchReviewers={searchReviewers}
      hasPushStep
      hasCloses
      create={create}
      requestReviewers={requestReviewers}
      onCreated={onCreated}
    />
  );
};
