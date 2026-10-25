import { useId, type KeyboardEvent } from 'react';
import { Button, Input, SegmentedTabs } from '@goodboy/ui';
import { CLONE_FORMS } from '../cloneForms';
import { CLONE_HOSTS } from '../cloneHosts';
import type { CloneRepository as CloneRepositoryModel } from '../useCloneRepository';
import { CloneFailureLine } from './CloneFailureLine';
import { CloneProgressLine } from './CloneProgressLine';

type Props = {
  readonly clone: CloneRepositoryModel;
  readonly isBusy: boolean;
};

type EnterParams = {
  readonly event: KeyboardEvent<HTMLInputElement>;
};

const HOST_OPTIONS = CLONE_HOSTS.map((option) => ({ value: option.key, label: option.label }));
const LOCKED_HOST_OPTIONS = HOST_OPTIONS.map((option) => ({ ...option, disabled: true }));

export const CloneRepository = ({ clone, isBusy }: Props) => {
  const addressId = useId();
  const intoId = useId();
  const hintId = useId();
  const isRunning = clone.status !== 'idle';
  const canStart = clone.canStart && !isBusy;

  const startClone = () => {
    if (!canStart) {
      return;
    }
    void clone.start();
  };

  if (!clone.isOpen) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-meta text-faint-foreground">
          Repository on GitHub, GitLab or Bitbucket?
        </p>
        <Button variant="ghost" size="xs" disabled={isBusy} onClick={clone.open}>
          Clone it
        </Button>
      </div>
    );
  }

  const startOnEnter = ({ event }: EnterParams) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    startClone();
  };

  return (
    <div
      role="group"
      aria-label="Clone a repository"
      className="flex flex-col gap-3 rounded-lg bg-subtle p-4 ring-1 ring-inset ring-border-soft"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={addressId} className="text-meta text-muted-foreground">
          Repository
        </label>
        <Input
          id={addressId}
          size="md"
          value={clone.text}
          disabled={isRunning}
          autoFocus
          spellCheck={false}
          placeholder="owner/name or https://github.com/owner/name"
          aria-invalid={clone.reading.kind === 'unknown'}
          aria-describedby={hintId}
          onChange={(event) => clone.setText({ text: event.target.value })}
          onKeyDown={(event) => startOnEnter({ event })}
          className="text-ui"
        />
        <p id={hintId} className="text-meta text-faint-foreground">
          {clone.reading.kind === 'unknown' ? CLONE_FORMS : 'GitHub, GitLab or Bitbucket.'}
        </p>
      </div>
      {clone.reading.kind === 'needs-host' ||
      (clone.reading.kind === 'ready' && clone.reading.form === 'owner-name') ? (
        <SegmentedTabs
          ariaLabel="Host"
          size="sm"
          options={isRunning ? LOCKED_HOST_OPTIONS : HOST_OPTIONS}
          value={clone.host}
          onChange={(host) => clone.setHost({ host })}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={intoId} className="text-meta text-muted-foreground">
          Clone into
        </label>
        <Input
          id={intoId}
          size="md"
          value={clone.destination}
          disabled={isRunning}
          spellCheck={false}
          placeholder="~/Developer/name"
          onChange={(event) => clone.setDestination({ text: event.target.value })}
          onKeyDown={(event) => startOnEnter({ event })}
          className="text-code"
        />
      </div>
      {clone.status === 'idle' ? null : (
        <CloneProgressLine
          phase={
            clone.status === 'checking' ? 'Checking access' : (clone.progress?.phase ?? 'Starting')
          }
          percent={clone.status === 'cloning' ? (clone.progress?.percent ?? null) : null}
          onCancel={() => void clone.cancel()}
        />
      )}
      {clone.failure === null ? null : (
        <CloneFailureLine
          failure={clone.failure}
          onRetry={startClone}
          onUseSuggestion={clone.applySuggestion}
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="md" disabled={isRunning} onClick={clone.close}>
          Close
        </Button>
        <Button
          size="md"
          disabled={!canStart}
          isBusy={isRunning}
          busyLabel="Cloning"
          onClick={startClone}
        >
          Clone
        </Button>
      </div>
    </div>
  );
};
