import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { lastOutputLine } from '../utils/lastOutputLine';
import { depsInstallScriptId } from '../utils/depsInstallScriptId';
import { NAMES } from '../utils/names';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly onInstalled?: () => void;
};

type Outcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'installed' }
  | { readonly kind: 'failed'; readonly message: string };

const IDLE: Outcome = { kind: 'idle' };
const WORKING_LABEL = 'Installing dependencies';
const INSTALLED_LABEL = 'Dependencies are installed.';

export const ReinstallDepsAction = ({ sessionId, mountId, worktreePath, onInstalled }: Props) => {
  const [outcome, setOutcome] = useState<Outcome>(IDLE);
  const [isStarting, setIsStarting] = useState(false);
  const scriptId = depsInstallScriptId({ mountId });
  const run = useAppStore((state) => state.scriptRuns[sessionId]?.[scriptId] ?? null);
  const isInstalling = run?.status === 'pending';
  const progress = isInstalling ? lastOutputLine({ output: run.output }) : null;

  const start = async (): Promise<void> => {
    setOutcome(IDLE);
    setIsStarting(true);
    const result = await useAppStore
      .getState()
      .reinstallWorktreeDeps({ sessionId, mountId, worktreePath });
    setIsStarting(false);
    if (result.kind === 'busy') {
      return;
    }
    if (result.kind === 'failed') {
      setOutcome({ kind: 'failed', message: result.message });
      return;
    }
    setOutcome({ kind: 'installed' });
    onInstalled?.();
  };

  if (isInstalling) {
    return (
      <span role="status" className="min-w-0 max-w-64 truncate text-meta text-muted-foreground">
        {progress === null ? WORKING_LABEL : `${WORKING_LABEL}: ${progress}`}
      </span>
    );
  }
  if (outcome.kind === 'installed') {
    return (
      <span role="status" className="text-meta text-muted-foreground">
        {INSTALLED_LABEL}
      </span>
    );
  }
  return (
    <>
      {outcome.kind === 'failed' && (
        <span role="alert" className="min-w-0 text-meta text-foreground">
          {`Couldn't install: ${outcome.message}`}
        </span>
      )}
      <Button size="sm" variant="secondary" isBusy={isStarting} onClick={() => void start()}>
        {NAMES.reinstallDeps}
      </Button>
    </>
  );
};
