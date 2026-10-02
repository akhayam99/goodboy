import type { ProjectId } from '@goodboy/types';
import { createGithubRepo, type GithubRepoVisibility } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import type { GetFn, SetFn } from '../../slice-types';
import { projectById } from '../projects/projectIndex';

export type PublishRemote =
  | {
      readonly kind: 'github';
      readonly name: string;
      readonly visibility: GithubRepoVisibility;
      readonly owner: string | null;
    }
  | { readonly kind: 'address'; readonly url: string };

export type PublishFirstLapStep = 'create' | 'link' | 'check' | 'push' | 'head';

export type PublishFirstLapResult =
  | { readonly kind: 'published'; readonly branch: string; readonly remoteUrl: string }
  | { readonly kind: 'remote-has-main'; readonly branch: string; readonly remoteUrl: string }
  | {
      readonly kind: 'failed';
      readonly step: PublishFirstLapStep;
      readonly message: string;
      readonly remoteUrl: string | null;
    };

type Input = {
  readonly projectId: ProjectId;
  readonly remote: PublishRemote;
};

const failure = ({
  step,
  message,
  remoteUrl = null,
}: {
  readonly step: PublishFirstLapStep;
  readonly message: string;
  readonly remoteUrl?: string | null;
}): PublishFirstLapResult => ({ kind: 'failed', step, message, remoteUrl });

type CreateParams = {
  readonly remote: Extract<PublishRemote, { kind: 'github' }>;
};

const createOnGithub = async ({
  remote,
}: CreateParams): Promise<
  { readonly url: string } | { readonly failed: PublishFirstLapResult }
> => {
  const created = await createGithubRepo({
    runner: tauriGhRunner,
    name: remote.name,
    owner: remote.owner,
    visibility: remote.visibility,
  });
  switch (created.kind) {
    case 'ok':
      return { url: created.repo.url };
    case 'invalid-name':
      return { failed: failure({ step: 'create', message: created.reason }) };
    case 'unauthenticated':
      return {
        failed: failure({
          step: 'create',
          message: 'GitHub did not accept the sign in. Connect GitHub again.',
        }),
      };
    case 'mismatch':
      return {
        failed: failure({
          step: 'create',
          message: `GitHub created ${created.actual.nameWithOwner} instead of ${created.expected.nameWithOwner}. It exists at ${created.actual.url} and was not removed.`,
          remoteUrl: created.actual.url,
        }),
      };
    case 'unverified':
      return { failed: failure({ step: 'create', message: created.message }) };
    case 'failed':
      return { failed: failure({ step: 'create', message: created.message }) };
    default: {
      const unreachable: never = created;
      return unreachable;
    }
  }
};

export const publishFirstLap = (_set: SetFn, get: GetFn) => {
  return async ({ projectId, remote }: Input): Promise<PublishFirstLapResult> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined || project.kind !== 'repo') {
      return failure({ step: 'link', message: 'This project is not a repository yet.' });
    }
    const created =
      remote.kind === 'github' ? await createOnGithub({ remote }) : { url: remote.url.trim() };
    if ('failed' in created) {
      return created.failed;
    }
    const remoteUrl = created.url;
    try {
      await get().linkProjectRemote({ projectId, remoteUrl });
    } catch (error) {
      return failure({ step: 'link', message: formatError(error), remoteUrl });
    }
    let published;
    try {
      published = await get().publishProjectMain({ projectId });
    } catch (error) {
      return failure({ step: 'push', message: formatError(error), remoteUrl });
    }
    switch (published.kind) {
      case 'published':
        await get().probeProjectRemote({ projectId });
        return { kind: 'published', branch: published.branch, remoteUrl };
      case 'remote-has-main':
        await get().probeProjectRemote({ projectId });
        return { kind: 'remote-has-main', branch: published.branch, remoteUrl };
      case 'no-remote':
        return failure({
          step: 'link',
          message: 'The address was not saved as a remote.',
          remoteUrl,
        });
      case 'nothing-to-publish':
        return failure({
          step: 'push',
          message: 'There is nothing to publish yet. Make the first commit first.',
          remoteUrl,
        });
      case 'failed':
        return failure({ step: published.step, message: published.message, remoteUrl });
      default: {
        const unreachable: never = published;
        return unreachable;
      }
    }
  };
};
