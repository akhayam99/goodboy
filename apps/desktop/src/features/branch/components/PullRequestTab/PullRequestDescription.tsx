import { useEffect, useState, type ClipboardEvent, type MouseEvent } from 'react';
import { Pencil } from 'lucide-react';
import {
  Button,
  EmptyLine,
  Notice,
  SectionHeader,
  SegmentedTabs,
  Textarea,
  formatError,
  useEscapeLayer,
} from '@goodboy/ui';
import type { PullRequestState, SessionId, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isInteractiveClick } from '../../../../shared/utils/isInteractiveClick';
import { useAppStore } from '../../../../store';
import { entryMountIdOf } from '../../../../store/slices/pull-request-view/entryMountId';
import { embedImageUrl } from './embedImageUrl';
import { RenderedBody } from './RenderedBody';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId | null;
  readonly pr: PullRequestState;
  readonly canEdit: boolean;
  readonly hostName: string;
  readonly onSaved: () => void;
};

type EditorView = 'write' | 'preview';

const EDITOR_VIEWS = [
  { value: 'write', label: 'Write' },
  { value: 'preview', label: 'Preview' },
] as const;

export const PullRequestDescription = ({
  sessionId,
  workspaceId,
  pr,
  canEdit,
  hostName,
  onSaved,
}: Props) => {
  const editPr = useAppStore((state) => state.editPr);
  const notePullRequestEdit = useAppStore((state) => state.notePullRequestEdit);
  const mountId = useAppStore((state) => entryMountIdOf({ state, sessionId }));
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [draft, setDraft] = useState(pr.body);
  const [view, setView] = useState<EditorView>('write');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setError(null);
    setIsSaved(false);
  }, [mountId, pr.number]);

  useEffect(() => {
    if (!isSaved) {
      return;
    }
    const timer = window.setTimeout(() => setIsSaved(false), 2600);
    return () => window.clearTimeout(timer);
  }, [isSaved]);

  const start = (): void => {
    if (!canEdit) {
      return;
    }
    setDraft(pr.body);
    setView('write');
    setError(null);
    setIsSaved(false);
    setIsEditing(true);
  };

  const cancel = (): void => {
    if (isBusy) {
      return;
    }
    setIsEditing(false);
    setError(null);
  };

  useEscapeLayer(cancel, isEditing);

  const save = (): void => {
    if (isBusy) {
      return;
    }
    if (draft === pr.body) {
      setIsEditing(false);
      return;
    }
    setIsBusy(true);
    setError(null);
    void (async () => {
      try {
        await editPr(sessionId, pr.number, {
          body: draft,
          isQuiet: true,
          ...(mountId === null ? {} : { mountId }),
        });
        notePullRequestEdit({
          sessionId,
          prNumber: pr.number,
          what: 'description',
          ...(mountId === null ? {} : { mountId }),
        });
        setIsEditing(false);
        setIsSaved(true);
        onSaved();
      } catch (caught) {
        setError(formatError(caught));
      } finally {
        setIsBusy(false);
      }
    })();
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget;
    const next = embedImageUrl({
      draft,
      pasted: event.clipboardData.getData('text'),
      start: target.selectionStart ?? draft.length,
      end: target.selectionEnd ?? draft.length,
    });
    if (next === null) {
      return;
    }
    event.preventDefault();
    setDraft(next);
  };

  const onBodyClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (!canEdit || isInteractiveClick({ target: event.target })) {
      return;
    }
    start();
  };

  const hasBody = pr.body.trim() !== '';
  const action = (
    <span className="flex items-center gap-2">
      {isSaved && (
        <span role="status" className="text-meta text-muted-foreground">
          Saved to {hostName}
        </span>
      )}
      {canEdit && !isEditing && (
        <Button size="xs" variant="ghost" onClick={start}>
          <Pencil size={ICON_SIZE.row} aria-hidden />
          Edit
        </Button>
      )}
    </span>
  );

  return (
    <section aria-label="Description" className="flex min-w-0 flex-col gap-3">
      <SectionHeader label="Description" headingLevel={2} action={action} />
      {isEditing ? (
        <div className="flex min-w-0 flex-col gap-3">
          <SegmentedTabs<EditorView>
            ariaLabel="Description editor"
            size="xs"
            className="w-fit"
            value={view}
            onChange={setView}
            options={EDITOR_VIEWS.map((option) => ({ ...option }))}
          />
          {view === 'write' ? (
            <Textarea
              autoFocus
              value={draft}
              disabled={isBusy}
              aria-label="Description, markdown"
              placeholder="What changed and why. Markdown works here."
              onChange={(event) => setDraft(event.target.value)}
              onPaste={onPaste}
              className="text-body"
              autoGrow
              minRows={6}
              maxRows={24}
            />
          ) : draft.trim() === '' ? (
            <EmptyLine>Nothing to preview yet.</EmptyLine>
          ) : (
            <RenderedBody text={draft} workspaceId={workspaceId} />
          )}
          {error !== null && (
            <Notice
              tone="danger"
              placement="inline"
              role="alert"
              title="Couldn't save the description"
              body={error}
              actions={
                <Button size="sm" variant="secondary" onClick={save} isBusy={isBusy}>
                  Retry
                </Button>
              }
            />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={save} isBusy={isBusy}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={isBusy}>
              Cancel
            </Button>
            <span className="text-meta text-faint-foreground">Markdown. Esc cancels.</span>
          </div>
        </div>
      ) : hasBody ? (
        <div
          onClick={onBodyClick}
          className={canEdit ? 'cursor-text rounded-md' : undefined}
          data-testid="pull-request-description"
        >
          <RenderedBody text={pr.body} workspaceId={workspaceId} />
        </div>
      ) : (
        <EmptyLine
          action={
            canEdit ? (
              <Button size="xs" variant="ghost" onClick={start}>
                Add description
              </Button>
            ) : undefined
          }
        >
          No description yet
        </EmptyLine>
      )}
    </section>
  );
};
