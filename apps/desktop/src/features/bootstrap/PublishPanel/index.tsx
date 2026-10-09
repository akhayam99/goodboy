import { useEffect, useId, useMemo, useState } from 'react';
import { Button, FormActions, Input, Notice, SegmentedTabs } from '@goodboy/ui';
import { validateGithubRepoName, type GithubRepoVisibility } from '@goodboy/core';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type {
  PublishFirstLapResult,
  PublishFirstLapStep,
  PublishRemote,
} from '../../../store/slices/bootstrap/publishFirstLap';
import { GithubFormBody } from '../../integrations/github/GithubFormBody';

type Where = 'github' | 'address';

type Props = {
  readonly project: Project;
  readonly primaryLabel?: string;
  readonly onPublished: (result: PublishFirstLapResult) => void;
  readonly onCancel: () => void;
};

const WHERE_OPTIONS = [
  { value: 'github', label: 'Create on GitHub' },
  { value: 'address', label: 'Use an existing repository' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
] as const;

const STEP_LABEL: Record<PublishFirstLapStep, string> = {
  create: 'Creating the repository failed',
  link: 'Linking the repository failed',
  check: 'Checking the repository failed',
  push: 'Publishing main failed',
  head: 'Setting the default branch failed',
};

export const PublishPanel = ({
  project,
  primaryLabel = 'Publish',
  onPublished,
  onCancel,
}: Props) => {
  const publishFirstLap = useAppStore((state) => state.publishFirstLap);
  const githubStatus = useAppStore((state) => state.githubStatus);
  const refreshGithubStatus = useAppStore((state) => state.refreshGithubStatus);
  const nameId = useId();
  const addressId = useId();
  const [where, setWhere] = useState<Where>('github');
  const [repoName, setRepoName] = useState(project.name);
  const [visibility, setVisibility] = useState<GithubRepoVisibility | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<PublishFirstLapResult, { kind: 'failed' }> | null>(
    null,
  );
  const [clash, setClash] = useState<string | null>(null);

  useEffect(() => {
    if (githubStatus === null) {
      void refreshGithubStatus();
    }
  }, [githubStatus, refreshGithubStatus]);

  const isToolAvailable = githubStatus?.available === true;
  const isSignedIn = isToolAvailable && githubStatus.mode !== 'absent';
  const owner = githubStatus?.user ?? null;
  const nameCheck = useMemo(() => validateGithubRepoName({ name: repoName }), [repoName]);
  const retryAddress = failure?.remoteUrl ?? null;

  const remote: PublishRemote | null =
    where === 'github'
      ? isSignedIn && nameCheck.kind === 'ok' && visibility !== null
        ? { kind: 'github', name: nameCheck.name, visibility, owner }
        : null
      : address.trim() === ''
        ? null
        : { kind: 'address', url: address.trim() };

  const publish = async (target: PublishRemote) => {
    setBusy(true);
    setFailure(null);
    setClash(null);
    try {
      const result = await publishFirstLap({ projectId: project.id, remote: target });
      if (result.kind === 'failed') {
        setFailure(result);
        return;
      }
      if (result.kind === 'remote-has-main') {
        setClash(result.remoteUrl);
      }
      onPublished(result);
    } finally {
      setBusy(false);
    }
  };

  const retryTarget: PublishRemote | null =
    retryAddress === null ? null : { kind: 'address', url: retryAddress };

  return (
    <section
      aria-label="Publish this project"
      className="flex flex-col gap-4 rounded-lg border border-border-soft bg-subtle p-4"
    >
      <SegmentedTabs
        size="sm"
        ariaLabel="Where to publish"
        options={WHERE_OPTIONS}
        value={where}
        onChange={(next) => setWhere(next)}
        fill
      />

      {where === 'github' ? (
        <div className="flex flex-col gap-4">
          {!isToolAvailable && githubStatus !== null ? (
            <p className="text-label text-muted-foreground">
              GitHub&apos;s command line tool isn&apos;t installed. Install it, or use an existing
              repository.
            </p>
          ) : null}
          {isToolAvailable && !isSignedIn ? (
            <div className="flex flex-col gap-2">
              <p className="text-label text-muted-foreground">
                Connect GitHub to create a repository.
              </p>
              <GithubFormBody workspaceId={null} onConnected={() => void refreshGithubStatus()} />
            </div>
          ) : null}
          {isSignedIn ? (
            <>
              <p className="text-label text-muted-foreground">
                Connected as {owner ?? 'your GitHub account'}
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor={nameId} className="text-label text-foreground">
                  Repository name
                </label>
                <Input
                  id={nameId}
                  value={repoName}
                  disabled={busy}
                  aria-invalid={nameCheck.kind === 'invalid'}
                  onChange={(event) => setRepoName(event.target.value)}
                />
                {nameCheck.kind === 'invalid' && repoName.trim() !== '' ? (
                  <span role="alert" className="text-meta text-danger">
                    {nameCheck.reason}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-label text-foreground">Visibility</span>
                <div role="radiogroup" aria-label="Visibility" className="flex gap-2">
                  {VISIBILITY_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={visibility === option.value}
                      variant={visibility === option.value ? 'primary' : 'secondary'}
                      disabled={busy}
                      onClick={() => setVisibility(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {visibility === null ? (
                  <span className="text-meta text-muted-foreground">
                    Pick who can see the repository. Goodboy does not choose for you.
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={addressId} className="text-label text-foreground">
            Repository address
          </label>
          <Input
            id={addressId}
            value={address}
            disabled={busy}
            placeholder="https://github.com/you/cascadia.git"
            onChange={(event) => setAddress(event.target.value)}
          />
          <span className="text-meta text-muted-foreground">
            Any HTTPS or SSH address works. The repository should be empty.
          </span>
        </div>
      )}

      {failure !== null ? (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={STEP_LABEL[failure.step]}
          body={
            failure.remoteUrl === null
              ? failure.message
              : `${failure.message} The repository exists at ${failure.remoteUrl} and was not removed.`
          }
          actions={
            retryTarget === null ? undefined : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void publish(retryTarget)}
              >
                Publish again
              </Button>
            )
          }
        />
      ) : null}

      {clash !== null ? (
        <Notice
          tone="info"
          placement="inline"
          role="status"
          title="That repository already has main"
          body="Nothing was pushed. Your work can move onto it."
        />
      ) : null}

      <FormActions>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={busy || remote === null}
          aria-busy={busy}
          onClick={() => (remote === null ? undefined : void publish(remote))}
        >
          {primaryLabel}
        </Button>
      </FormActions>
    </section>
  );
};
