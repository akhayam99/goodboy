import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Input, SegmentedTabs, Select, StatusDot } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { listOwnedRepos, type GithubRepoRef } from '@goodboy/core';
import { Check, GitBranch } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { tauriGhRunner } from '../../../github/github';

type Props = {
  readonly open: boolean;
  readonly workspace: Workspace;
  readonly onClose: () => void;
};

type Host = 'github' | 'gitlab';

const HOST_NAME: Record<Host, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

const HOST_STUDIO_EVENT: Record<Host, string> = {
  github: 'goodboy:open-github-studio',
  gitlab: 'goodboy:open-gitlab-studio',
};

const HOST_URL_PLACEHOLDER: Record<Host, string> = {
  github: 'https://github.com/owner/repo.git',
  gitlab: 'https://gitlab.com/owner/repo.git',
};

const MANUAL_REPO = '__manual__';

export const ConvertWorkspaceDialog = ({ open, workspace, onClose }: Props) => {
  const convertWorkspaceToRepo = useAppStore((s) => s.convertWorkspaceToRepo);
  const isGithubConnected = useAppStore((s) => s.githubStatus?.available === true);
  const isGitlabConnected = useAppStore((s) =>
    (s.workspaceIntegrations[workspace.id] ?? []).some(
      (integration) => integration.provider === 'gitlab',
    ),
  );

  const [host, setHost] = useState<Host>('github');
  const [repos, setRepos] = useState<ReadonlyArray<GithubRepoRef>>([]);
  const [areReposLoading, setAreReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(MANUAL_REPO);
  const [manualUrl, setManualUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConverted, setIsConverted] = useState(false);
  const keepDraftRef = useRef(false);

  const isConnected = host === 'github' ? isGithubConnected : isGitlabConnected;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (keepDraftRef.current) {
      keepDraftRef.current = false;
      return;
    }
    setHost('github');
    setSelectedRepo(MANUAL_REPO);
    setManualUrl('');
    setIsBusy(false);
    setError(null);
    setIsConverted(false);
  }, [open]);

  useEffect(() => {
    if (!open || host !== 'github' || !isGithubConnected) {
      return;
    }
    let cancelled = false;
    setAreReposLoading(true);
    listOwnedRepos(tauriGhRunner)
      .then((found) => {
        if (!cancelled) {
          setRepos(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRepos([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAreReposLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, host, isGithubConnected]);

  const picked = repos.find((repo) => repo.nameWithOwner === selectedRepo) ?? null;
  const remoteUrl = picked?.url ?? manualUrl.trim();

  const onConnect = useCallback(() => {
    keepDraftRef.current = true;
    onClose();
    window.dispatchEvent(new CustomEvent(HOST_STUDIO_EVENT[host]));
  }, [host, onClose]);

  const onConvert = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await convertWorkspaceToRepo({ workspaceId: workspace.id, remoteUrl });
      setIsConverted(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  }, [convertWorkspaceToRepo, remoteUrl, workspace.id]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={isConverted ? 'This is a dev project now' : 'Turn this into a dev project'}
      description={
        isConverted
          ? undefined
          : 'Add a git repository to this workspace so sessions get their own branch and pull requests.'
      }
      footer={
        isConverted ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            {error != null && <span className="mr-auto text-xs text-danger">{error}</span>}
            <Button variant="ghost" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              onClick={() => void onConvert()}
              disabled={isBusy || !isConnected || remoteUrl === ''}
              aria-busy={isBusy}
              className={isBusy ? 'animate-border-pulse' : undefined}
            >
              Convert to dev project
            </Button>
          </>
        )
      }
    >
      {isConverted ? (
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-1.5 text-xs text-success">
            <Check size={12} aria-hidden />
            {workspace.name} is backed by git
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            New sessions get their own branch and worktree. The sessions you already have keep
            working as plain folders.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SegmentedTabs
            ariaLabel="Repository host"
            options={[
              { value: 'github', label: 'GitHub' },
              { value: 'gitlab', label: 'GitLab' },
            ]}
            value={host}
            onChange={setHost}
            fill
          />

          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <Check size={11} aria-hidden />
              {HOST_NAME[host]} is connected
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusDot tone="warning" size="sm" />
                {HOST_NAME[host]} is not connected yet
              </span>
              <Button size="sm" variant="secondary" onClick={onConnect}>
                Connect {HOST_NAME[host]}
              </Button>
            </div>
          )}

          {host === 'github' && isConnected && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">repository</span>
              <Select
                block
                value={selectedRepo}
                onChange={(event) => setSelectedRepo(event.target.value)}
                disabled={isBusy || areReposLoading}
                aria-label="repository"
              >
                <option value={MANUAL_REPO}>
                  {areReposLoading ? 'loading your repositories…' : 'paste a remote url instead'}
                </option>
                {repos.map((repo) => (
                  <option key={repo.nameWithOwner} value={repo.nameWithOwner}>
                    {repo.nameWithOwner}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {(host === 'gitlab' || selectedRepo === MANUAL_REPO) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">remote url</span>
              <Input
                value={manualUrl}
                placeholder={HOST_URL_PLACEHOLDER[host]}
                onChange={(event) => setManualUrl(event.target.value)}
                disabled={isBusy || !isConnected}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Create the repository on {HOST_NAME[host]} first, then paste its clone url here.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">what happens</span>
            <ul className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <GitBranch size={11} aria-hidden className="shrink-0" />
                git starts tracking {workspace.rootPath}
              </li>
              <li>your session folders and .goodboy stay out of version control</li>
              <li>one first commit is made so sessions can get their own worktree</li>
              <li>the repository you picked becomes the origin remote</li>
            </ul>
          </div>
        </div>
      )}
    </Dialog>
  );
};
