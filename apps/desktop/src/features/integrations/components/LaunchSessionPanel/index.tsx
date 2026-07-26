import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Divider,
  Input,
  SectionHeader,
  SegmentedTabs,
  StatusDot,
  Textarea,
} from '@goodboy/ui';
import { AlertTriangle, ArrowRight, GitBranch, MessagesSquare, Target } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { isValidBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { SetupWorkflowToggle } from '../../../session/components/SetupWorkflowToggle';
import { useSetupWorkflowPreference } from '../../../session/hooks/useSetupWorkflowPreference';
import { removeWorktree } from '../../../worktree/worktree';
import { useBranchConflict } from '../../../worktree/useBranchConflict';
import { LaunchField } from './parts/LaunchField';

type AdoptableBranch = {
  readonly label: string;
  readonly branch: string | null;
  readonly hint: string;
  readonly isResolving: boolean;
  readonly error: string | null;
};

type ExternalTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly linkedSessionId: SessionId | null;
  readonly goalSeed: string;
  readonly branchSlugSeed: string;
  readonly externalTask: ExternalTask;
  readonly adoptable?: AdoptableBranch | null;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 48;

export const LaunchSessionPanel = ({
  workspaceId,
  linkedSessionId,
  goalSeed,
  branchSlugSeed,
  externalTask,
  adoptable = null,
  onClose,
}: Props) => {
  const createSession = useAppStore((state) => state.createSession);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const rootPath = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.rootPath ?? null,
  );
  const { showToast } = useToast();
  const [setupWorkflow, setSetupWorkflow] = useSetupWorkflowPreference();
  const [goal, setGoal] = useState(goalSeed);
  const [branchSlug, setBranchSlug] = useState(branchSlugSeed);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [modeChoice, setModeChoice] = useState<'adopt' | 'fresh' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goalSeedRef = useRef(goalSeed);

  useEffect(() => {
    const previousSeed = goalSeedRef.current;
    goalSeedRef.current = goalSeed;
    setGoal((current) => (current === previousSeed ? goalSeed : current));
  }, [goalSeed]);

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [loadSetting, workspaceId]);

  const mode = modeChoice ?? (adoptable == null ? 'fresh' : 'adopt');
  const prefix = sanitizeBranchPrefix({ input: branchPrefix }) || DEFAULT_BRANCH_PREFIX;
  const isSlugValid = isValidBranchSlug({ slug: branchSlug });
  const isAdopting = mode === 'adopt' && adoptable != null;
  const adoptedBranch = isAdopting ? adoptable.branch : null;
  const effectiveBranch = isAdopting
    ? adoptedBranch
    : isSlugValid
      ? `${prefix}/${branchSlug.trim()}`
      : null;
  const conflict = useBranchConflict(effectiveBranch, rootPath);
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictPath = conflict?.kind === 'worktree' ? conflict.path : null;
  const openableSessionId = linkedSessionId ?? conflictSessionId;
  const isMissingBase = error != null && isMissingBaseRefError(error);
  const isBranchReady = isAdopting ? adoptedBranch != null && !adoptable.isResolving : isSlugValid;
  const canLaunch = goal.trim() !== '' && isBranchReady && !busy && conflictPath == null;

  const launch = async (eraseWorktreePath?: string) => {
    setError(null);
    setBusy(true);
    try {
      if (eraseWorktreePath != null && rootPath != null) {
        await removeWorktree(rootPath, eraseWorktreePath);
      }
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: prefix,
        branchSlug: branchSlug.trim() || undefined,
        ...(adoptedBranch != null ? { existingBranch: adoptedBranch } : {}),
        externalTask,
        openWorkflowBuilder: setupWorkflow,
      });
      showToast('success', `Session created: ${session.goal}`);
      onClose();
    } catch (launchError) {
      setError(formatError(launchError));
    } finally {
      setBusy(false);
    }
  };

  if (openableSessionId != null) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader label="launch session" />
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
            <MessagesSquare size={15} className="text-success" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">Session already launched</span>
            <span className="truncate text-2xs text-muted-foreground">
              {linkedSessionId != null
                ? 'A session is linked to this issue.'
                : 'A session is already on this branch.'}
            </span>
          </div>
          <OpenSessionButton sessionId={openableSessionId} onOpened={onClose} />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="launch session"
        action={
          <SetupWorkflowToggle
            checked={setupWorkflow}
            disabled={busy}
            onChange={setSetupWorkflow}
          />
        }
      />

      <LaunchField label="Goal" icon={<Target size={13} aria-hidden className="text-primary" />}>
        <Textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          autoGrow
          minRows={3}
          maxRows={10}
          disabled={busy}
          aria-label="Session goal"
        />
      </LaunchField>

      <LaunchField
        label="Branch"
        icon={<GitBranch size={13} aria-hidden className="text-success" />}
      >
        <div className="flex flex-col gap-2">
          {adoptable != null && (
            <SegmentedTabs
              ariaLabel="branch source"
              options={[
                { value: 'adopt', label: adoptable.label, disabled: busy },
                { value: 'fresh', label: 'Start fresh', disabled: busy },
              ]}
              value={mode}
              onChange={setModeChoice}
              size="sm"
            />
          )}
          {isAdopting ? (
            <div className="flex flex-col gap-1">
              <div className="flex min-h-8 items-center gap-2 bg-subtle/40 px-2.5 font-mono text-sm">
                {adoptable.isResolving ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <StatusDot tone="info" size="sm" pulsing /> resolving…
                  </span>
                ) : adoptedBranch != null ? (
                  <span className="truncate text-foreground">{adoptedBranch}</span>
                ) : (
                  <span className="truncate text-danger">
                    {adoptable.error ?? 'No branch found'}
                  </span>
                )}
              </div>
              <span className="text-2xs leading-relaxed text-muted-foreground/70">
                {adoptable.hint}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {prefix + '/'}
              </span>
              <Input
                value={branchSlug}
                onChange={(event) =>
                  setBranchSlug(
                    sanitizeBranchSlug({ input: event.target.value, maxLength: SLUG_MAX_LEN }),
                  )
                }
                placeholder="branch-slug"
                className="h-8 flex-1 font-mono text-sm"
                disabled={busy}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Branch slug"
              />
            </div>
          )}
          {conflictPath != null && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
              <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0 text-warning" />
              <span>
                This branch is already checked out in another worktree (
                <span className="break-all font-mono">{conflictPath}</span>). Launching erases that
                worktree and recreates it here.
              </span>
            </div>
          )}
        </div>
      </LaunchField>

      {isMissingBase && <BaseBranchGuide />}

      <Divider />

      <footer className="flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          {error != null && !isMissingBase && (
            <span
              role="alert"
              className="inline-flex min-w-0 items-center gap-1 text-xs text-danger"
            >
              <AlertTriangle size={12} aria-hidden className="shrink-0" />
              {error}
            </span>
          )}
        </div>
        {conflictPath != null ? (
          <Button
            variant="danger"
            onClick={() => void launch(conflictPath)}
            disabled={busy || goal.trim() === ''}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {busy ? 'Working…' : 'Erase worktree & launch'}
          </Button>
        ) : (
          <Button
            onClick={() => void launch()}
            disabled={!canLaunch}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {busy ? 'Launching…' : 'Launch session'}
            {!busy && <ArrowRight size={13} className="ml-1.5" aria-hidden />}
          </Button>
        )}
      </footer>
    </section>
  );
};
