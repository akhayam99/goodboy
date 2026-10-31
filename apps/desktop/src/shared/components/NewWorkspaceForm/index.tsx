import { useId, type FormEvent, type KeyboardEvent } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, FormActions, KeyHint, FOCUS_RING, cn } from '@goodboy/ui';
import { formatCombo, shortcutGlyphs } from '../../keyboard/registry';
import { isSubmitChord } from '../../keyboard/isSubmitChord';
import { folderName } from '../../../store/slices/terminal/terminalOwner';
import { pluralize } from '../../utils/pluralize';
import { copyOf } from './newWorkspaceCopy';
import { CloneRepository } from './CloneRepository';
import { DropZone } from './DropZone';
import { FolderRows } from './FolderRows';
import { LikelyFolders } from './LikelyFolders';
import { NameField } from './NameField';
import type { NewWorkspaceMode } from './newWorkspaceMode';
import { ReconnectNotice } from './ReconnectNotice';
import { ScratchFields } from './ScratchFields';
import { useCloneRepository } from './useCloneRepository';
import { useLikelyFolders } from './useLikelyFolders';
import { useWorkspaceDraft, type DraftStart } from './useWorkspaceDraft';

type NewWorkspaceTitleRole = 'display' | 'title' | 'heading';

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

type Props = {
  readonly mode: NewWorkspaceMode;
  readonly workspaceId?: WorkspaceId;
  readonly start?: DraftStart;
  readonly titleRole?: NewWorkspaceTitleRole;
  readonly onCreated?: (params: CreatedParams) => void;
  readonly onCancel?: () => void;
  readonly backLabel?: string;
  readonly error?: string | null;
};

const CHOOSE_COMBO = 'cmd+KeyO';

const TITLE_CLASS = {
  display: 'text-display',
  title: 'text-title',
  heading: 'text-heading',
} as const satisfies Record<NewWorkspaceTitleRole, string>;

const DEFAULT_ROLE = {
  'first-run': 'display',
  new: 'title',
  add: 'title',
} as const satisfies Record<NewWorkspaceMode, NewWorkspaceTitleRole>;

const isChooseChord = (event: KeyboardEvent): boolean =>
  event.code === 'KeyO' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;

export const NewWorkspaceForm = ({
  mode,
  workspaceId,
  start = 'folder',
  titleRole,
  onCreated,
  onCancel,
  backLabel = 'Back',
  error = null,
}: Props) => {
  const draft = useWorkspaceDraft({ mode, workspaceId, start, onCreated });
  const likely = useLikelyFolders({ isEnabled: mode === 'first-run' });
  const clone = useCloneRepository({ onCloned: ({ path }) => void draft.drop({ paths: [path] }) });
  const reasonId = useId();
  const copy = copyOf({ mode, targetName: mode === 'add' ? draft.name : '' });
  const isReading = draft.readingPath !== null || draft.isPicking;
  const isBusy = isReading || draft.isCreating || clone.status !== 'idle';
  const isAdding = mode === 'add';
  const isOpenStage = draft.stage === 'folders' || draft.stage === 'scratch';
  const hasTicks = draft.stage === 'empty' && likely.ticked.length > 0;
  const createLabel = isAdding
    ? `Add ${pluralize(draft.folderCount, 'folder')}`
    : 'Create workspace';
  const busyLabel = isAdding
    ? 'Adding folders'
    : `Creating ${draft.name.trim() === '' ? 'workspace' : draft.name.trim()}`;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isOpenStage) {
      void draft.create();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (isSubmitChord(event) && isOpenStage) {
      event.preventDefault();
      void draft.create();
      return;
    }
    if (isChooseChord(event) && draft.stage === 'empty' && !isBusy) {
      event.preventDefault();
      void draft.choose();
    }
  };

  const back =
    onCancel === undefined ? null : (
      <Button variant="quiet" size="md" disabled={draft.isCreating} onClick={onCancel}>
        {backLabel}
      </Button>
    );

  const primary = isOpenStage ? (
    <Button
      type="submit"
      size="md"
      disabled={draft.block !== null || isReading}
      isBusy={draft.isCreating}
      busyLabel={busyLabel}
      aria-describedby={draft.block === null ? undefined : reasonId}
      data-demo-anchor="setup-create"
    >
      {draft.error === null ? createLabel : 'Retry'}
      <KeyHint keys={shortcutGlyphs('composer.submit')} isOnTone />
    </Button>
  ) : hasTicks ? (
    <Button
      size="md"
      disabled={clone.status !== 'idle'}
      isBusy={isReading}
      busyLabel="Reading folders"
      onClick={() => void draft.drop({ paths: likely.ticked }).then(likely.clear)}
    >
      {`Look in ${pluralize(likely.ticked.length, 'folder')}`}
    </Button>
  ) : (
    <Button
      size="md"
      disabled={clone.status !== 'idle'}
      isBusy={isReading}
      busyLabel="Reading folder"
      onClick={() => void draft.choose()}
      data-demo-anchor="setup-choose-folder"
    >
      Choose folder
      <KeyHint keys={formatCombo(CHOOSE_COMBO)} isOnTone />
    </Button>
  );

  const reason =
    draft.stage === 'folders' && draft.block !== null && draft.folderCount > 0 ? draft.block : null;

  return (
    <form
      aria-label={copy.title}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      className="flex w-full flex-col gap-6 text-left"
    >
      <div className="flex flex-col gap-2">
        <h2
          tabIndex={-1}
          data-step-title
          className={`${TITLE_CLASS[titleRole ?? DEFAULT_ROLE[mode]]} text-foreground outline-none`}
        >
          {copy.title}
        </h2>
        <p className="text-prose text-muted-foreground">{copy.lede}</p>
      </div>

      {draft.stage === 'empty' ? (
        <div className="flex flex-col gap-3">
          <DropZone
            readingName={
              draft.readingPath === null ? null : folderName({ path: draft.readingPath })
            }
            isBusy={isBusy}
            onChoose={() => void draft.choose()}
            onDrop={({ paths }) => void draft.drop({ paths })}
          />
          {mode === 'first-run' ? <LikelyFolders likely={likely} isBusy={isBusy} /> : null}
          {mode === 'first-run' ? (
            <CloneRepository clone={clone} isBusy={isReading || draft.isCreating} />
          ) : null}
          {isAdding ? null : (
            <p className="text-meta text-faint-foreground">
              Want a new folder?{' '}
              <button
                type="button"
                disabled={isBusy}
                onClick={draft.startScratch}
                className={cn('text-primary underline-offset-2 hover:underline', FOCUS_RING)}
              >
                Start from scratch
              </button>{' '}
              with a new empty repository.
            </p>
          )}
        </div>
      ) : null}

      {draft.stage === 'scratch' ? (
        <div className="flex flex-col gap-3">
          <ScratchFields scratch={draft.scratch} isBusy={isBusy} />
          <p className="text-meta text-faint-foreground">
            Have a folder already?{' '}
            <button
              type="button"
              disabled={isBusy}
              onClick={draft.backToEmpty}
              className={cn('text-primary underline-offset-2 hover:underline', FOCUS_RING)}
            >
              Choose a folder
            </button>
          </p>
        </div>
      ) : null}

      {draft.stage === 'folders' ? (
        <div className="flex flex-col gap-4">
          {isAdding ? null : (
            <NameField
              workspaceId={draft.workspaceId}
              name={draft.name}
              sourceName={draft.sourceName}
              isBusy={isBusy}
              onNameChange={draft.setName}
            />
          )}
          {draft.reconnectOffer === null ? null : (
            <ReconnectNotice
              offer={draft.reconnectOffer}
              isBusy={isBusy}
              onReconnect={() => void draft.reconnect()}
              onDismiss={draft.dismissReconnect}
            />
          )}
          <FolderRows
            draft={draft}
            home={draft.scratch.home}
            destinationName={draft.name}
            isBusy={isBusy}
          />
        </div>
      ) : null}

      <FormActions
        leading={
          draft.stage === 'folders' ? (
            <span className="text-meta text-faint-foreground">
              {pluralize(draft.folderCount, 'folder')}
            </span>
          ) : null
        }
        error={draft.error ?? error}
        reason={reason}
        reasonId={reasonId}
      >
        {back}
        {primary}
      </FormActions>
    </form>
  );
};
