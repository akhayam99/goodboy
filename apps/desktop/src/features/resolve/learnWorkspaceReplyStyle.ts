import { invoke } from '@tauri-apps/api/core';
import { detectRepoSlug, learnReplyStyle, listMyReviewReplies } from '@goodboy/core/github';
import { formatError } from '@goodboy/ui';
import type { TaskModelPreference, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../integrations/github/github';

const NOTE_IS_SAFE = 'Your note is unchanged.';
const NO_GITHUB_PROJECT = `No project in this workspace is on GitHub. ${NOTE_IS_SAFE}`;
const CONNECT_GITHUB = `Connect GitHub to read your replies. ${NOTE_IS_SAFE}`;
const NO_REPLIES_READ = `Couldn't read your replies on GitHub. ${NOTE_IS_SAFE}`;
const NO_REVIEW_REPLIES = `Couldn't find review replies you wrote on GitHub. ${NOTE_IS_SAFE}`;
const NO_STYLE_NOTE = `Couldn't write a style note from your replies. ${NOTE_IS_SAFE}`;
const SIGNED_OUT = /auth login|not logged in|authentication|credentials|HTTP 401/i;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly githubRoots: ReadonlyArray<string>;
  readonly taskModel: TaskModelPreference;
};

type RepliesParams = {
  readonly workspaceId: WorkspaceId;
  readonly repoSlugs: ReadonlyArray<string>;
  readonly cwd: string;
};

const readReplies = async ({ workspaceId, repoSlugs, cwd }: RepliesParams) => {
  try {
    return await listMyReviewReplies({
      runner: tauriGhRunner,
      repoSlugs,
      opts: { workspaceId, cwd },
    });
  } catch (error) {
    if (SIGNED_OUT.test(formatError(error))) {
      throw new Error(CONNECT_GITHUB, { cause: error });
    }
    throw new Error(NO_REPLIES_READ, { cause: error });
  }
};

export const learnWorkspaceReplyStyle = async ({
  workspaceId,
  githubRoots,
  taskModel,
}: Params): Promise<string> => {
  const [firstRoot] = githubRoots;
  if (firstRoot === undefined) {
    throw new Error(NO_GITHUB_PROJECT);
  }
  const slugs = await Promise.all(
    githubRoots.map((root) => detectRepoSlug(tauriGhRunner, root, workspaceId).catch(() => null)),
  );
  const repoSlugs = [...new Set(slugs.flatMap((slug) => (slug == null ? [] : [slug])))];
  if (repoSlugs.length === 0) {
    throw new Error(CONNECT_GITHUB);
  }
  const replies = await readReplies({ workspaceId, repoSlugs, cwd: firstRoot });
  if (replies.length === 0) {
    throw new Error(NO_REVIEW_REPLIES);
  }
  const note = await learnReplyStyle(
    { ...taskModel, workingDir: firstRoot, invokeFn: invoke },
    replies,
  );
  if (note === null) {
    throw new Error(NO_STYLE_NOTE);
  }
  return note;
};
