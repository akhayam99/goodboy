import type { GhRunner } from '@goodboy/core';

const ISSUE_ASSETS_REPO_NAME = 'goodboy-issue-assets';

const ISSUE_ASSETS_REPO_DESCRIPTION = 'Screenshots attached to Goodboy issue reports';

type SlugParams = {
  readonly login: string;
};

export const issueAssetsRepoSlug = ({ login }: SlugParams): string =>
  `${login}/${ISSUE_ASSETS_REPO_NAME}`;

type ExistsParams = {
  readonly runner: GhRunner;
  readonly slug: string;
};

export const hasIssueAssetsRepo = async ({ runner, slug }: ExistsParams): Promise<boolean> => {
  try {
    const result = await runner.run(['api', `repos/${slug}`, '--jq', '.full_name'], {});
    return result.exitCode === 0;
  } catch {
    return false;
  }
};

type CreateParams = {
  readonly runner: GhRunner;
};

export const createIssueAssetsRepo = async ({ runner }: CreateParams): Promise<boolean> => {
  try {
    const result = await runner.run(
      [
        'api',
        '--method',
        'POST',
        'user/repos',
        '-f',
        `name=${ISSUE_ASSETS_REPO_NAME}`,
        '-f',
        `description=${ISSUE_ASSETS_REPO_DESCRIPTION}`,
        '-F',
        'private=false',
        '-F',
        'auto_init=true',
      ],
      {},
    );
    return result.exitCode === 0;
  } catch {
    return false;
  }
};
