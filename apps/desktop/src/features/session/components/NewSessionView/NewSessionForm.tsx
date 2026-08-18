import type { ChangeEventHandler, ReactNode, RefObject } from 'react';
import {
  Divider,
  FileDropZone,
  IconButton,
  Input,
  PANE_RHYTHM,
  SectionHeader,
  Skeleton,
  Textarea,
  cn,
  tintClasses,
} from '@goodboy/ui';
import { AlertTriangle, Expand, Paperclip } from 'lucide-react';
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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { Tone } from '@goodboy/ui';

const sectionGlyph = ({
  Icon,
  tone,
}: {
  readonly Icon: (typeof CONCEPT_ICONS)[keyof typeof CONCEPT_ICONS];
  readonly tone: Tone;
}): ReactNode => <Icon size={14} aria-hidden className={tintClasses(tone).icon} />;

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
  const locationLabel = isSimple ? 'Folder' : 'Branch';
  const locationGlyph = isSimple
    ? sectionGlyph({ Icon: CONCEPT_ICONS.explore, tone: CONCEPT_TONE.explore })
    : sectionGlyph({ Icon: CONCEPT_ICONS.branch, tone: CONCEPT_TONE.branch });

  return (
    <div className={cn('flex w-full flex-col', PANE_RHYTHM.stack)}>
      <header className="flex items-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Create session</h1>
      </header>

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

      {!isSimple && issueSources.length > 0 ? (
        <>
          <Divider />
          <section className="flex flex-col gap-3">
            <SectionHeader
              size="page"
              label="Start from an issue"
              icon={sectionGlyph({
                Icon: CONCEPT_ICONS.integrations,
                tone: CONCEPT_TONE.integrations,
              })}
            />
            <IssueSourceField
              workspaceId={workspaceId}
              sources={issueSources}
              value={issue}
              disabled={busy}
              onPick={onPickIssue}
              onClear={onClearIssue}
            />
          </section>
        </>
      ) : null}

      <Divider />
      <section className="flex flex-col gap-3">
        <SectionHeader
          size="page"
          label="Goal"
          icon={sectionGlyph({ Icon: CONCEPT_ICONS.goal, tone: CONCEPT_TONE.goal })}
        />
        <div className="flex w-full items-start gap-2">
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
            {goalEditorDirty ? <span className="text-2xs text-warning">Unsaved edits</span> : null}
          </div>
        </div>
        <FileDropZone
          ref={composerRef}
          data-drop-composer
          actionIcon={<Paperclip size={13} aria-hidden />}
          actionLabel="Add files or drag"
          isDisabled={busy}
          isDragging={isDragging}
          onSelect={() => fileInputRef.current?.click()}
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
        </FileDropZone>
      </section>

      <Divider />
      <section className="flex flex-col gap-3">
        <SectionHeader size="page" label={locationLabel} icon={locationGlyph} />
        {isSimple ? (
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">sessions/</span>
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
        ) : (
          <div className="flex w-full flex-col gap-3">
            <BranchModeToggle mode={branchMode} onChange={onBranchModeChange} disabled={busy} />
            {branchMode === 'new' ? (
              <div className="flex w-full items-center gap-1.5">
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
              <div className="flex w-full flex-col gap-1.5">
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
                      <span className="break-all font-mono">{conflictWorktreePath}</span>). Creating
                      erases that worktree and recreates it here.
                    </span>
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
