import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Divider, Textarea, cn } from '@goodboy/ui';
import { AlertTriangle, ArrowRight, Folder, GitBranch } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { isValidBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { validateSessionDirectoryName } from '../../../../shared/utils/validateSessionDirectoryName';
import { deriveDefaultSessionDirectoryNameFromGoal } from '../../../../shared/utils/deriveDefaultSessionDirectoryNameFromGoal';
import { buildSimpleSessionDirectoryPath } from '../../../../shared/utils/buildSimpleSessionDirectoryPath';
import { sessionDirectoryNameValidationMessage } from '../../../../shared/utils/sessionDirectoryNameValidationMessage';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { removeWorktree } from '../../../worktree/worktree';
import { useBranchConflict } from '../../../worktree/useBranchConflict';
import { useSimpleSessionDirectoryConflict } from '../../../worktree/useSimpleSessionDirectoryConflict';
import type { AdoptableBranch } from './adoptableBranch';
import { BranchDetails } from './BranchDetails';
import { ConfigToggle } from './ConfigToggle';
import { FolderDetails } from './FolderDetails';
import { LaunchedNotice } from './LaunchedNotice';

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
  adoptable: adoptableInput = null,
  onClose,
}: Props) => {
  const createSession = useAppStore((state) => state.createSession);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const rootPath = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.rootPath ?? null,
  );
  const isBranchless = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.kind === 'simple',
  );
  const adoptable = isBranchless ? null : adoptableInput;
  const { showToast } = useToast();
  const configId = useId();
  const [goal, setGoal] = useState(goalSeed);
  const [branchSlug, setBranchSlug] = useState(branchSlugSeed);
  const [folderName, setFolderName] = useState(() =>
    deriveDefaultSessionDirectoryNameFromGoal({ goal: goalSeed }),
  );
  const [folderNameTouched, setFolderNameTouched] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [modeChoice, setModeChoice] = useState<'adopt' | 'fresh' | null>(null);
  const [isConfigRevealed, setConfigRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goalSeedRef = useRef(goalSeed);

  useEffect(() => {
    const previousSeed = goalSeedRef.current;
    goalSeedRef.current = goalSeed;
    setGoal((current) => (current === previousSeed ? goalSeed : current));
  }, [goalSeed]);

  useEffect(() => {
    if (!isBranchless || folderNameTouched) {
      return;
    }
    const nextFolderName = deriveDefaultSessionDirectoryNameFromGoal({ goal });
    if (nextFolderName === folderName) {
      return;
    }
    setFolderName(nextFolderName);
  }, [folderName, folderNameTouched, goal, isBranchless]);

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [loadSetting, workspaceId]);

  const mode = modeChoice ?? (adoptable == null ? 'fresh' : 'adopt');
  const prefix = sanitizeBranchPrefix({ input: branchPrefix }) || DEFAULT_BRANCH_PREFIX;
  const isSlugValid = isValidBranchSlug({ slug: branchSlug });
  const folderValidation = validateSessionDirectoryName({ name: folderName });
  const folderNameError = sessionDirectoryNameValidationMessage({ validation: folderValidation });
  const folderPathPreview =
    isBranchless && rootPath != null
      ? buildSimpleSessionDirectoryPath({
          workspaceRoot: rootPath,
          folderName,
        })
      : null;
  const folderConflictPath =
    isBranchless && folderValidation.ok && folderPathPreview != null ? folderPathPreview : null;
  const folderConflict = useSimpleSessionDirectoryConflict({ path: folderConflictPath });
  const isAdopting = mode === 'adopt' && adoptable != null;
  const adoptedBranch = isAdopting ? adoptable.branch : null;
  const effectiveBranch = isBranchless
    ? null
    : isAdopting
      ? adoptedBranch
      : isSlugValid
        ? `${prefix}/${branchSlug.trim()}`
        : null;
  const conflict = useBranchConflict(effectiveBranch, rootPath);
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictPath = conflict?.kind === 'worktree' ? conflict.path : null;
  const openableSessionId = linkedSessionId ?? conflictSessionId;
  const isMissingBase = error != null && isMissingBaseRefError(error);
  const isBranchReady = isBranchless
    ? true
    : isAdopting
      ? adoptedBranch != null && !adoptable.isResolving
      : isSlugValid;
  const isFolderReady =
    !isBranchless || (folderValidation.ok && !folderConflict.exists && !folderConflict.checking);
  const canLaunch =
    goal.trim() !== '' && isBranchReady && isFolderReady && !busy && conflictPath == null;
  const isResolvingAdopted = isAdopting && adoptable.isResolving;
  const needsConfig =
    conflictPath != null ||
    isMissingBase ||
    (isBranchless && (folderNameError != null || folderConflict.exists)) ||
    (!isBranchless && !isBranchReady && !isResolvingAdopted);

  useEffect(() => {
    if (!needsConfig) {
      return;
    }
    setConfigRevealed(true);
  }, [needsConfig]);

  const isConfigOpen = isConfigRevealed || needsConfig;
  const configLabel = isBranchless
    ? `sessions/${folderName}`
    : isAdopting
      ? isResolvingAdopted
        ? 'resolving…'
        : (adoptedBranch ?? 'no branch found')
      : `${prefix}/${branchSlug}`;

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
        ...(isBranchless
          ? { folderName }
          : { branchPrefix: prefix, branchSlug: branchSlug.trim() || undefined }),
        ...(adoptedBranch != null ? { existingBranch: adoptedBranch } : {}),
        externalTask,
      });
      showToast('success', `Session created: ${session.goal}`);
      onClose();
    } catch (launchError) {
      setError(formatError(launchError));
    } finally {
      setBusy(false);
    }
  };

  const onGoalKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    if (!canLaunch) {
      return;
    }
    void launch();
  };

  if (openableSessionId != null) {
    return (
      <LaunchedNotice
        sessionId={openableSessionId}
        isLinkedToIssue={linkedSessionId != null}
        onOpened={onClose}
      />
    );
  }

  return (
    <section
      aria-label="Launch session"
      className="flex flex-col gap-1 rounded-md bg-subtle/80 p-2 ring-1 ring-border-soft motion-safe:transition-shadow focus-within:ring-2 focus-within:ring-primary/40"
    >
      <div id={configId} className={cn('flex flex-col', isConfigOpen && 'gap-3 px-1')}>
        {isConfigOpen ? (
          <>
            {isBranchless ? (
              <FolderDetails
                folderName={folderName}
                onFolderNameChange={(next) => {
                  setFolderName(next);
                  setFolderNameTouched(true);
                }}
                pathPreview={folderPathPreview}
                nameError={folderNameError}
                exists={folderConflict.exists}
                isChecking={folderConflict.checking}
                busy={busy}
              />
            ) : (
              <BranchDetails
                adoptable={adoptable}
                mode={mode}
                onModeChange={setModeChoice}
                prefix={prefix}
                branchSlug={branchSlug}
                onBranchSlugChange={setBranchSlug}
                slugMaxLength={SLUG_MAX_LEN}
                conflictPath={conflictPath}
                busy={busy}
              />
            )}
            {isMissingBase && <BaseBranchGuide />}
            <Divider />
          </>
        ) : null}
      </div>

      <Textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        onKeyDown={onGoalKeyDown}
        autoGrow
        minRows={2}
        maxRows={10}
        disabled={busy}
        aria-label="Session goal"
        placeholder="What should this session do?"
        className="border-0 bg-transparent px-2 leading-relaxed shadow-none focus-visible:shadow-none focus-visible:ring-0"
      />

      {error != null && !isMissingBase && (
        <span
          role="alert"
          className="flex items-start gap-1.5 px-2 text-2xs leading-relaxed text-danger"
        >
          <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </span>
      )}

      <footer className="flex items-center justify-between gap-3 px-1">
        <ConfigToggle
          icon={
            isBranchless ? <Folder size={11} aria-hidden /> : <GitBranch size={11} aria-hidden />
          }
          label={configLabel}
          controls={configId}
          isOpen={isConfigOpen}
          needsAttention={needsConfig}
          onToggle={() => setConfigRevealed(!isConfigOpen)}
        />
        {conflictPath != null ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => void launch(conflictPath)}
            disabled={busy || goal.trim() === ''}
            className={cn('shrink-0', busy && 'animate-border-pulse')}
          >
            {busy ? 'Working…' : 'Erase worktree & launch'}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => void launch()}
            disabled={!canLaunch}
            className={cn('shrink-0', busy && 'animate-border-pulse')}
          >
            {busy ? 'Launching…' : 'Launch session'}
            {!busy && <ArrowRight size={13} aria-hidden />}
          </Button>
        )}
      </footer>
    </section>
  );
};
