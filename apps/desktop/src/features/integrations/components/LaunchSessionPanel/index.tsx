import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Divider,
  FieldRow,
  Input,
  SectionHeader,
  SegmentedTabs,
  StatusDot,
  Textarea,
} from '@goodboy/ui';
import { AlertTriangle, ArrowRight, Folder, GitBranch, MessagesSquare } from 'lucide-react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { isValidBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { validateSessionDirectoryName } from '../../../../shared/utils/validateSessionDirectoryName';
import { deriveDefaultSessionDirectoryNameFromGoal } from '../../../../shared/utils/deriveDefaultSessionDirectoryNameFromGoal';
import { buildSimpleSessionDirectoryPath } from '../../../../shared/utils/buildSimpleSessionDirectoryPath';
import { sessionDirectoryNameValidationMessage } from '../../../../shared/utils/sessionDirectoryNameValidationMessage';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { removeWorktree } from '../../../worktree/worktree';
import { useBranchConflict } from '../../../worktree/useBranchConflict';
import { useSimpleSessionDirectoryConflict } from '../../../worktree/useSimpleSessionDirectoryConflict';

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
  const [goal, setGoal] = useState(goalSeed);
  const [branchSlug, setBranchSlug] = useState(branchSlugSeed);
  const [folderName, setFolderName] = useState(() =>
    deriveDefaultSessionDirectoryNameFromGoal({ goal: goalSeed }),
  );
  const [folderNameTouched, setFolderNameTouched] = useState(false);
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
      <SectionHeader label="launch session" />

      <FieldRow label="Goal" layout="stacked">
        <Textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          autoGrow
          minRows={3}
          maxRows={10}
          disabled={busy}
          aria-label="Session goal"
          className="w-full"
        />
      </FieldRow>

      {isBranchless ? (
        <>
          <Divider />
          <section className="flex flex-col">
            <SectionHeader
              icon={<Folder size={12} aria-hidden />}
              label="Folder"
              hint="This is the folder name you will find on disk inside your workspace folder."
            />
            <FieldRow
              label="Folder name"
              help="The app creates this folder in your workspace under sessions"
              layout="stacked"
            >
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex w-full items-center gap-1.5">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    sessions/
                  </span>
                  <Input
                    value={folderName}
                    onChange={(event) => {
                      setFolderName(event.target.value);
                      setFolderNameTouched(true);
                    }}
                    placeholder="session"
                    className="h-8 min-w-0 flex-1 text-sm"
                    disabled={busy}
                    aria-label="Folder name"
                  />
                </div>
                {folderPathPreview != null ? (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    Folder on disk:{' '}
                    <span className="break-all font-mono text-muted-foreground">
                      {folderPathPreview}
                    </span>
                  </p>
                ) : null}
                {folderNameError != null ? (
                  <p role="alert" className="text-2xs leading-relaxed text-danger">
                    {folderNameError}
                  </p>
                ) : null}
                {folderNameError == null && folderConflict.exists ? (
                  <p role="alert" className="text-2xs leading-relaxed text-danger">
                    A folder with this name already exists in this workspace
                  </p>
                ) : null}
                {folderNameError == null && !folderConflict.exists && folderConflict.checking ? (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    Checking if this folder already exists
                  </p>
                ) : null}
              </div>
            </FieldRow>
          </section>
        </>
      ) : (
        <>
          <Divider />
          <section className="flex flex-col">
            <div className="flex flex-col gap-2">
              <SectionHeader icon={<GitBranch size={12} aria-hidden />} label="Branch" />
              {adoptable != null ? (
                <SegmentedTabs
                  ariaLabel="branch source"
                  options={[
                    { value: 'adopt', label: adoptable.label, disabled: busy },
                    { value: 'fresh', label: 'Start fresh', disabled: busy },
                  ]}
                  value={mode}
                  onChange={setModeChoice}
                  size="sm"
                  fill
                />
              ) : null}
            </div>
            <FieldRow
              label={isAdopting ? 'Adopted branch' : 'Branch name'}
              help={isAdopting ? adoptable.hint : undefined}
              layout="stacked"
            >
              <div className="flex w-full flex-col gap-1.5">
                {isAdopting ? (
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
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {prefix + '/'}
                    </span>
                    <Input
                      value={branchSlug}
                      onChange={(event) =>
                        setBranchSlug(
                          sanitizeBranchSlug({
                            input: event.target.value,
                            maxLength: SLUG_MAX_LEN,
                          }),
                        )
                      }
                      placeholder="branch-slug"
                      className="h-8 min-w-0 flex-1 font-mono text-sm"
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
                      <span className="break-all font-mono">{conflictPath}</span>). Launching erases
                      that worktree and recreates it here.
                    </span>
                  </div>
                )}
              </div>
            </FieldRow>
          </section>
        </>
      )}

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
            {!busy && <ArrowRight size={13} aria-hidden />}
          </Button>
        )}
      </footer>
    </section>
  );
};
