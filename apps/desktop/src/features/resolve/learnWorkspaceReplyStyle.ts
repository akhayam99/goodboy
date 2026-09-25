import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  detectRepoSlug,
  learnReplyStyle,
  listMyReviewReplies,
  resolveTaskModel,
} from '@goodboy/core';
import type { OverrideSettings, ProviderId, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../github/github';

export const NO_WORKSPACE_REPO = 'No project in this workspace is a GitHub repository.';
export const NO_REVIEW_REPLIES = "Couldn't find review replies you wrote in this workspace.";
export const NO_STYLE_NOTE = "Couldn't write a style note from your replies. Try again.";

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly projectRoots: ReadonlyArray<string>;
  readonly overrides: OverrideSettings | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

export const learnWorkspaceReplyStyle = async ({
  workspaceId,
  projectRoots,
  overrides,
  connectedProviders,
}: Params): Promise<string> => {
  const slugs = await Promise.all(
    projectRoots.map((root) => detectRepoSlug(tauriGhRunner, root, workspaceId).catch(() => null)),
  );
  const repoSlugs = [...new Set(slugs.flatMap((slug) => (slug == null ? [] : [slug])))];
  if (repoSlugs.length === 0) {
    throw new Error(NO_WORKSPACE_REPO);
  }
  const replies = await listMyReviewReplies({
    runner: tauriGhRunner,
    repoSlugs,
    opts: { workspaceId, ...(projectRoots[0] !== undefined && { cwd: projectRoots[0] }) },
  });
  if (replies.length === 0) {
    throw new Error(NO_REVIEW_REPLIES);
  }
  const taskModel = resolveTaskModel({
    task: 'prose_polish',
    preferences: overrides?.taskModels,
    workspaceDefaultProviderId: overrides?.defaultProviderId,
    sessionDefaultProviderId:
      connectedProviders[0] ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
    connectedProviders: connectedProviders.length > 0 ? connectedProviders : null,
  });
  const note = await learnReplyStyle(
    {
      ...taskModel,
      ...(projectRoots[0] !== undefined && { workingDir: projectRoots[0] }),
      invokeFn: invoke,
    },
    replies,
  );
  if (note === null) {
    throw new Error(NO_STYLE_NOTE);
  }
  return note;
};
