import type { ChangeEventHandler, RefObject } from 'react';
import {
  Divider,
  FieldRow,
  IconButton,
  Input,
  SectionHeader,
  Skeleton,
  Textarea,
  cn,
} from '@goodboy/ui';
import { AlertTriangle, Expand, Folder, GitBranch, Paperclip, Target } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import {
  AttachmentChip,
  pendingAttachmentProps,
} from '../../../attachments/components/AttachmentChip';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';
import type { PendingAttachment } from '../../../chat/components/ChatInput/lib';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueSource } from '../../../integrations/issueSources';
import { BranchCombobox } from '../../../worktree/BranchCombobox';
import type { LocalBranchInfo } from '../../../worktree/worktree';
import { DEFAULT_BRANCH_PREFIX } from '../../../settings/settings';
import { PROVIDER_ORDER } from '../../../providers/components/ProviderStudio/providerOrder';
import { BranchModeToggle } from './BranchModeToggle';
import { IssueSourceField } from './IssueSourceField';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type BranchMode = 'new' | 'existing';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isSimple: boolean;
  readonly noProviderConnected: boolean;
  readonly onOpenSettings: () => void;
  readonly issueSources: ReadonlyArray<IssueSource>;
  readonly issue: IssueCandidate | null;
  readonly onPickIssue: (candidate: IssueCandidate) => void;
  readonly onClearIssue: () => void;
  readonly goal: string;
  readonly onGoalChange: (value: string) => void;
  readonly onOpenGoalEditor: () => void;
  readonly goalEditorDirty: boolean;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly isDragging: boolean;
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileInputChange: ChangeEventHandler<HTMLInputElement>;
  readonly onRemoveAttachment: (id: string) => void;
  readonly branchMode: BranchMode;
  readonly onBranchModeChange: (mode: BranchMode) => void;
  readonly branchPrefix: string;
  readonly branchSlug: string;
  readonly onBranchSlugChange: (value: string) => void;
  readonly folderName: string;
  readonly onFolderNameChange: (value: string) => void;
  readonly folderPathPreview: string | null;
  readonly folderNameError: string | null;
  readonly folderConflict: boolean;
  readonly folderConflictChecking: boolean;
  readonly slugGenerating: boolean;
  readonly onGenerateSlug: () => void;
  readonly existingBranches: ReadonlyArray<LocalBranchInfo>;
  readonly existingBranch: string;
  readonly onExistingBranchChange: (value: string) => void;
  readonly branchesLoading: boolean;
  readonly conflictSessionId: SessionId | null;
  readonly conflictWorktreePath: string | null;
  readonly busy: boolean;
};

export const NewSessionForm = ({
  workspaceId,
  isSimple,
  noProviderConnected,
  onOpenSettings,
  issueSources,
  issue,
  onPickIssue,
  onClearIssue,
  goal,
  onGoalChange,
  onOpenGoalEditor,
  goalEditorDirty,
  attachments,
  isDragging,
  composerRef,
  fileInputRef,
  onFileInputChange,
  onRemoveAttachment,
  branchMode,
  onBranchModeChange,
  branchPrefix,
  branchSlug,
  onBranchSlugChange,
  folderName,
  onFolderNameChange,
  folderPathPreview,
  folderNameError,
  folderConflict,
  folderConflictChecking,
  slugGenerating,
  onGenerateSlug,
  existingBranches,
  existingBranch,
  onExistingBranchChange,
  branchesLoading,
  conflictSessionId,
  conflictWorktreePath,
  busy,
}: Props) => {
  return (
    <div className="flex w-full flex-col gap-6">
      {noProviderConnected ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs"
        >
          <AlertTriangle size={13} aria-hidden className="shrink-0 text-warning" />
          <div className="flex-1 leading-relaxed text-foreground">
            No provider is connected. A session needs at least one of{' '}
            {PROVIDER_ORDER.map((id, index) => (
              <span key={id}>
                <span className="font-medium">{PROVIDER_LABEL[id]}</span>
                {index < PROVIDER_ORDER.length - 1 ? ', ' : ''}
              </span>
            ))}{' '}
            connected to run.{' '}
            <button
              type="button"
              onClick={onOpenSettings}
              className="underline underline-offset-2 hover:text-warning"
            >
              Open settings
            </button>
            .
          </div>
        </div>
      ) : null}

      <section className="flex flex-col">
        <SectionHeader
          icon={<Target size={12} aria-hidden />}
          label="Session details"
          hint="Give the agents a clear outcome and any supporting context they should have."
        />
        {!isSimple && issueSources.length > 0 ? (
          <>
            <FieldRow
              label="Start from an issue"
              help="Start from an assigned issue and fill the goal and branch automatically."
            >
              <div className="w-full sm:w-96">
                <IssueSourceField
                  workspaceId={workspaceId}
                  sources={issueSources}
                  value={issue}
                  disabled={busy}
                  onPick={onPickIssue}
                  onClear={onClearIssue}
                />
              </div>
            </FieldRow>
            <Divider />
          </>
        ) : null}
        <FieldRow
          label="Goal"
          help="What this session should accomplish. This becomes the agents' primary context."
        >
          <div className="flex w-full items-start gap-1.5 sm:w-96">
            <Textarea
              value={goal}
              placeholder={
                isSimple
                  ? 'Prepare a study plan for next week’s exam…'
                  : 'Refactor auth domain to extract token validation into a shared module…'
              }
              onChange={(event) => onGoalChange(event.target.value)}
              autoGrow
              minRows={4}
              maxRows={12}
              autoFocus
              disabled={busy}
              aria-label="Goal"
              className="min-w-0 flex-1"
            />
            <div className="flex shrink-0 flex-col items-end gap-1">
              <IconButton
                icon={Expand}
                label="Open goal editor"
                onClick={onOpenGoalEditor}
                disabled={busy}
                className={cn(busy && 'cursor-not-allowed text-muted-foreground/30')}
              />
              {goalEditorDirty ? (
                <span className="text-2xs text-warning">Unsaved edits</span>
              ) : null}
            </div>
          </div>
        </FieldRow>
        <Divider />
        <FieldRow
          label="Attachments"
          help="Images and files the agents can read on demand when they need more context."
        >
          <div
            ref={composerRef}
            data-drop-composer
            className={cn(
              'flex w-full flex-col gap-2 rounded-lg border border-dashed p-3 motion-safe:transition-colors sm:w-96',
              isDragging ? 'border-primary bg-primary/5' : 'border-border-soft',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              hidden
              onChange={onFileInputChange}
            />
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <AttachmentChip
                    key={attachment.id}
                    {...pendingAttachmentProps(attachment)}
                    onRemove={() => onRemoveAttachment(attachment.id)}
                  />
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs motion-safe:transition-colors',
                busy
                  ? 'cursor-not-allowed text-muted-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Paperclip size={13} aria-hidden />
              Add files
            </button>
          </div>
        </FieldRow>
      </section>

      <Divider />
      {isSimple ? (
        <>
          <section className="flex flex-col">
            <SectionHeader
              icon={<Folder size={12} aria-hidden />}
              label="Folder"
              hint="This is the folder name you will find on disk inside your workspace folder."
            />
            <FieldRow
              label="Folder name"
              help="The app creates this folder in your workspace under sessions"
            >
              <div className="flex w-full flex-col gap-1.5 sm:w-96">
                <div className="flex w-full items-center gap-1.5">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    sessions/
                  </span>
                  <Input
                    value={folderName}
                    onChange={(event) => onFolderNameChange(event.target.value)}
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
                {folderNameError == null && folderConflict ? (
                  <p role="alert" className="text-2xs leading-relaxed text-danger">
                    A folder with this name already exists in this workspace
                  </p>
                ) : null}
                {folderNameError == null && !folderConflict && folderConflictChecking ? (
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
          <section className="flex flex-col">
            <SectionHeader
              icon={<GitBranch size={12} aria-hidden />}
              label="Branch"
              hint="Each session uses its own worktree on a new or existing local branch."
            />
            <FieldRow label="Source" help="Create a fresh branch or attach this session to one.">
              <BranchModeToggle mode={branchMode} onChange={onBranchModeChange} disabled={busy} />
            </FieldRow>
            <Divider />
            <FieldRow
              label={branchMode === 'new' ? 'Branch name' : 'Existing branch'}
              help={
                branchMode === 'new'
                  ? 'The workspace prefix stays fixed while the goal suggests a concise slug.'
                  : 'Choose a local branch that is not already owned by another open session.'
              }
            >
              {branchMode === 'new' ? (
                <div className="flex w-full items-center gap-1.5 sm:w-96">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {branchPrefix.length > 0 ? branchPrefix : DEFAULT_BRANCH_PREFIX}/
                  </span>
                  {slugGenerating ? (
                    <Skeleton className="h-8 flex-1 rounded-md border border-border" />
                  ) : (
                    <Input
                      value={branchSlug}
                      onChange={(event) => onBranchSlugChange(event.target.value)}
                      placeholder="branch-slug"
                      className="h-8 min-w-0 flex-1 font-mono text-sm"
                      disabled={busy}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Branch slug"
                    />
                  )}
                  <button
                    type="button"
                    onClick={onGenerateSlug}
                    disabled={goal.trim().length === 0 || slugGenerating || busy}
                    title="Generate branch name from goal"
                    aria-label="Generate branch name from goal"
                    className={cn(
                      'shrink-0 rounded-md border border-border p-2 text-xs motion-safe:transition-colors',
                      goal.trim().length > 0 && !slugGenerating && !busy
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'cursor-not-allowed text-muted-foreground/30',
                    )}
                  >
                    <CONCEPT_ICONS.enhance size={13} aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="flex w-full flex-col gap-1.5 sm:w-96">
                  <BranchCombobox
                    branches={existingBranches}
                    value={existingBranch}
                    onChange={onExistingBranchChange}
                    disabled={busy || branchesLoading}
                    loading={branchesLoading}
                  />
                  {conflictSessionId != null ? (
                    <p className="text-2xs leading-relaxed text-muted-foreground">
                      This branch is already used by an open session. Open it instead of creating a
                      duplicate.
                    </p>
                  ) : conflictWorktreePath != null ? (
                    <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
                      <AlertTriangle size={12} aria-hidden className="shrink-0" />
                      <span>
                        Checked out in another worktree (
                        <span className="break-all font-mono">{conflictWorktreePath}</span>).
                        Creating erases that worktree and recreates it here.
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
            </FieldRow>
          </section>
        </>
      )}
    </div>
  );
};
