import { openToolSettings } from '../../../integrations/openToolSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  FormActions,
  formatError,
  Input,
  Listbox,
  SegmentedTabs,
  StatusDot,
} from '@goodboy/ui';
import type { Project, WorkspaceId } from '@goodboy/types';
import {
  createGithubRepo,
  listOwnedRepos,
  validateGithubRepoName,
  type GithubRepoRef,
  type GithubRepoVisibility,
  type OwnedReposResult,
} from '@goodboy/core';
import { Check, GitBranch } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/names';
import { tauriGhRunner } from '../../../integrations/github/github';
import { lastPathSegment } from '../WorkspaceLinkForm/lastPathSegment';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly project: Project;
  readonly onClose: () => void;
};

type Host = 'github' | 'gitlab';

type Action = 'create' | 'link';

type ReposState = OwnedReposResult | { readonly kind: 'idle' } | { readonly kind: 'loading' };

const HOST_NAME: Record<Host, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

const ACTION_OPTIONS = [
  { value: 'create', label: 'Create new' },
  { value: 'link', label: NAMES.addExisting },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
] as const;

const HOST_URL_PLACEHOLDER: Record<Host, string> = {
  github: 'https://github.com/owner/repo.git',
  gitlab: 'https://gitlab.com/owner/repo.git',
};

const MANUAL_REPO = '__manual__';

const NO_REPOS: ReadonlyArray<GithubRepoRef> = [];

const repoDestination = ({
  owner,
  name,
}: {
  readonly owner: string | null;
  readonly name: string;
}): string => (owner === null ? name : `${owner}/${name}`);

const visibilityWord = ({ isPrivate }: { readonly isPrivate: boolean }): string =>
  isPrivate ? 'private' : 'public';

type Orphan = {
  readonly nameWithOwner: string;
  readonly url: string;
};

export const ConvertWorkspaceFlow = ({ workspaceId, project, onClose }: Props) => {
  const convertProjectToRepo = useAppStore((state) => state.convertProjectToRepo);
  const projectId = project.id;
  const isGithubCliAvailable = useAppStore((s) => s.githubStatus?.available === true);
  const isGitlabConnected = useAppStore((s) =>
    (s.workspaceIntegrations[workspaceId] ?? []).some(
      (integration) => integration.provider === 'gitlab',
    ),
  );
  const githubOwner = useAppStore((s) => s.githubStatus?.user ?? null);

  const [action, setAction] = useState<Action>('create');
  const [host, setHost] = useState<Host>('github');
  const [reposState, setReposState] = useState<ReposState>({ kind: 'idle' });
  const [selectedRepo, setSelectedRepo] = useState(MANUAL_REPO);
  const [manualUrl, setManualUrl] = useState('');
  const [repoName, setRepoName] = useState(() => lastPathSegment({ path: project.rootPath }));
  const [visibility, setVisibility] = useState<GithubRepoVisibility | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orphan, setOrphan] = useState<Orphan | null>(null);
  const [isConverted, setIsConverted] = useState(false);

  const repos = reposState.kind === 'ok' ? reposState.repos : NO_REPOS;
  const areReposLoading = reposState.kind === 'loading';
  const isGithubConnected = isGithubCliAvailable && reposState.kind !== 'unauthenticated';
  const isConnected = host === 'github' ? isGithubConnected : isGitlabConnected;
  const nameCheck = useMemo(() => validateGithubRepoName({ name: repoName }), [repoName]);

  useEffect(() => {
    if (host !== 'github' || !isGithubCliAvailable) {
      return;
    }
    let cancelled = false;
    setReposState({ kind: 'loading' });
    listOwnedRepos(tauriGhRunner)
      .then((result) => {
        if (!cancelled) {
          setReposState(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReposState({ kind: 'failed', message: formatError(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [host, isGithubCliAvailable]);

  const picked =
    host === 'github' ? (repos.find((repo) => repo.nameWithOwner === selectedRepo) ?? null) : null;
  const remoteUrl = picked?.url ?? manualUrl.trim();

  const onHostChange = useCallback((next: Host) => {
    setHost(next);
    setReposState({ kind: 'idle' });
    setSelectedRepo(MANUAL_REPO);
    setManualUrl('');
    setError(null);
  }, []);

  const onActionChange = useCallback((next: Action) => {
    setAction(next);
    setHost('github');
    setError(null);
  }, []);

  const onConnect = useCallback(() => {
    openToolSettings({ tool: host });
  }, [host]);

  const onConvert = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await convertProjectToRepo({ projectId, remoteUrl });
      setIsConverted(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  }, [convertProjectToRepo, projectId, remoteUrl]);

  const onCreate = useCallback(async () => {
    if (nameCheck.kind !== 'ok' || visibility === null) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setOrphan(null);
    try {
      const result = await createGithubRepo({
        runner: tauriGhRunner,
        name: nameCheck.name,
        owner: githubOwner,
        visibility,
      });
      if (result.kind === 'invalid-name') {
        setError(result.reason);
        return;
      }
      if (result.kind === 'unauthenticated') {
        setError('GitHub turned the request down. Sign in with `gh auth login`, then try again.');
        return;
      }
      if (result.kind === 'failed') {
        setError(result.message);
        return;
      }
      if (result.kind === 'unverified') {
        setError(result.message);
        return;
      }
      if (result.kind === 'mismatch') {
        setError(
          `GitHub returned ${result.actual.nameWithOwner}, a ${visibilityWord({ isPrivate: result.actual.isPrivate })} repository, and you asked for ${result.expected.nameWithOwner} as ${visibilityWord({ isPrivate: result.expected.isPrivate })}. Nothing was linked and no remote was set. It exists on GitHub at ${result.actual.url} and was not removed.`,
        );
        return;
      }

      try {
        await convertProjectToRepo({ projectId, remoteUrl: result.repo.url });
      } catch (err) {
        setOrphan({ nameWithOwner: result.repo.nameWithOwner, url: result.repo.url });
        setError(formatError(err));
        return;
      }
      setIsConverted(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  }, [convertProjectToRepo, githubOwner, nameCheck, projectId, visibility]);

  const isCreating = action === 'create';
  const canCreate = isConnected && nameCheck.kind === 'ok' && visibility !== null;
  const primaryDisabled = isBusy || (isCreating ? !canCreate : !isConnected || remoteUrl === '');

  return (
    <section
      aria-label={isConverted ? 'This is a dev project now' : 'Turn this into a dev project'}
      className="flex flex-col gap-4 rounded-lg border border-border-soft bg-background p-3"
    >
      {isConverted ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-1.5 text-label text-success">
              <Check size={ICON_SIZE.row} aria-hidden />
              {project.name} is backed by git
            </span>
            <p className="text-secondary text-muted-foreground">
              New sessions get their own branch. Nothing of yours is committed.
            </p>
          </div>
          <FormActions>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Done
            </Button>
          </FormActions>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {orphan != null && (
              <p role="status" className="text-secondary text-warning">
                {orphan.nameWithOwner} was created on GitHub before this failed. It exists on GitHub
                at {orphan.url} and was not removed. Delete it yourself if you do not want it, or
                pick it from {NAMES.addExisting}.
              </p>
            )}

            <SegmentedTabs
              ariaLabel="Repository setup"
              options={ACTION_OPTIONS}
              value={action}
              onChange={onActionChange}
              fill
            />

            {isCreating ? (
              <p className="text-secondary text-muted-foreground">
                Goodboy creates the repository on GitHub. A GitLab project is added from{' '}
                {NAMES.addExisting} instead.
              </p>
            ) : (
              <SegmentedTabs
                ariaLabel="Repository host"
                options={[
                  { value: 'github', label: 'GitHub' },
                  { value: 'gitlab', label: 'GitLab' },
                ]}
                value={host}
                onChange={onHostChange}
                fill
              />
            )}

            {isConnected ? (
              <span className="flex items-center gap-1.5 text-label text-success">
                <Check size={11} aria-hidden />
                {HOST_NAME[host]} is connected
              </span>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-subtle px-3 py-2">
                <span className="flex items-center gap-1.5 text-label text-muted-foreground">
                  <StatusDot tone="warning" size="sm" />
                  {reposState.kind === 'unauthenticated'
                    ? 'the GitHub CLI is installed but not signed in'
                    : `${HOST_NAME[host]} is not connected yet`}
                </span>
                <Button size="sm" variant="secondary" onClick={onConnect}>
                  Connect {HOST_NAME[host]}
                </Button>
              </div>
            )}

            {isCreating && isConnected && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-row text-foreground">Repository name</span>
                  <Input
                    value={repoName}
                    placeholder={lastPathSegment({ path: project.rootPath })}
                    onChange={(event) => setRepoName(event.target.value)}
                    disabled={isBusy}
                    aria-label="Repository name"
                    aria-invalid={nameCheck.kind === 'invalid'}
                  />
                  {nameCheck.kind === 'invalid' && repoName.trim() !== '' && (
                    <span role="alert" className="text-label text-danger">
                      {nameCheck.reason}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-row text-foreground">Visibility</span>
                  <div role="radiogroup" aria-label="Visibility" className="flex gap-2">
                    {VISIBILITY_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        role="radio"
                        aria-checked={visibility === option.value}
                        variant={visibility === option.value ? 'primary' : 'secondary'}
                        onClick={() => setVisibility(option.value)}
                        disabled={isBusy}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {visibility === null && (
                    <span className="text-label text-muted-foreground">
                      Pick who can see the repository. Goodboy does not choose for you.
                    </span>
                  )}
                </div>

                {nameCheck.kind === 'ok' && visibility !== null && (
                  <p className="text-secondary text-foreground">
                    Create {repoDestination({ owner: githubOwner, name: nameCheck.name })} as a{' '}
                    {visibility} repository and set it as this folder&apos;s origin remote.
                  </p>
                )}
              </>
            )}

            {!isCreating && host === 'github' && isConnected && (
              <div className="flex flex-col gap-1.5">
                <span className="text-row text-foreground">Repository</span>
                <Listbox
                  isBlock
                  value={selectedRepo}
                  options={[
                    {
                      value: MANUAL_REPO,
                      label: areReposLoading
                        ? 'loading your repositories…'
                        : 'paste a remote url instead',
                    },
                    ...repos.map((repo) => ({
                      value: repo.nameWithOwner,
                      label: repo.nameWithOwner,
                    })),
                  ]}
                  onChange={setSelectedRepo}
                  disabled={isBusy || areReposLoading}
                  ariaLabel="Repository"
                />
                {reposState.kind === 'ok' && repos.length === 0 && (
                  <span className="text-label text-muted-foreground">
                    this account owns no repositories yet
                  </span>
                )}
                {reposState.kind === 'failed' && (
                  <span className="text-label text-muted-foreground">
                    gh could not list your repositories: {reposState.message}
                  </span>
                )}
              </div>
            )}

            {!isCreating && (host === 'gitlab' || selectedRepo === MANUAL_REPO) && (
              <div className="flex flex-col gap-1.5">
                <span className="text-row text-foreground">Remote URL</span>
                <Input
                  value={manualUrl}
                  placeholder={HOST_URL_PLACEHOLDER[host]}
                  onChange={(event) => setManualUrl(event.target.value)}
                  disabled={isBusy || !isConnected}
                />
                <p className="text-secondary text-muted-foreground">
                  Create the repository on {HOST_NAME[host]} first, then paste its clone url here.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-row text-foreground">What happens</span>
              <ul className="flex flex-col gap-1 text-secondary text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <GitBranch size={11} aria-hidden className="shrink-0" />
                  Git starts tracking {project.rootPath}
                </li>
                <li>The first commit holds a .gitignore and nothing else.</li>
                <li>Your files stay untracked until you add them yourself.</li>
                <li>Your session folders and .goodboy stay out of version control.</li>
                <li>
                  {isCreating
                    ? 'The repository Goodboy creates becomes the origin remote.'
                    : 'The repository you picked becomes the origin remote.'}
                </li>
              </ul>
            </div>
          </div>
          <FormActions
            leading={error == null ? null : <span className="text-label text-danger">{error}</span>}
          >
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isBusy}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void (isCreating ? onCreate() : onConvert())}
              disabled={primaryDisabled}
              aria-busy={isBusy}
            >
              <span className={isBusy ? 'text-shimmer' : undefined}>
                {isCreating ? 'Create repository' : 'Convert to dev project'}
              </span>
            </Button>
          </FormActions>
        </div>
      )}
    </section>
  );
};
