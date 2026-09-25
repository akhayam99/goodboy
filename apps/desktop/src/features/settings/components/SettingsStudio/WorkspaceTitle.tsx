import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Input, Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const SUBTITLE = 'What this workspace works on, who you are, and how new sessions start.';

export const WorkspaceTitle = ({ workspaceId }: Props) => {
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId) ?? null);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const reportError = useAppStore((s) => s.reportError);
  const name = workspace?.name ?? '';
  const [draft, setDraft] = useState(name);
  const [isEditing, setEditing] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const commit = async () => {
    if (isCancelledRef.current) {
      isCancelledRef.current = false;
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (workspace == null || next === '' || next === workspace.name) {
      setDraft(name);
      return;
    }
    setRenaming(true);
    try {
      await renameWorkspace({ workspaceId, name: next });
    } catch (err) {
      void reportError({ title: "Couldn't rename the workspace", error: err, workspaceId });
      setDraft(workspace.name);
    } finally {
      setRenaming(false);
    }
  };

  if (workspace == null) {
    return (
      <h1 className="min-w-0 truncate text-lg font-semibold leading-6 text-foreground">
        Workspace
      </h1>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {isEditing ? (
        <Input
          type="text"
          value={draft}
          autoFocus
          aria-label="Workspace name"
          placeholder={workspace.slug}
          maxLength={60}
          disabled={isRenaming}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              isCancelledRef.current = true;
              cancel();
            }
          }}
          className="h-8 max-w-sm text-lg font-semibold"
        />
      ) : (
        <div className="group flex min-h-8 min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold leading-6 text-foreground">
            {draft}
          </h1>
          <Tooltip content="Rename" anchorClassName="flex shrink-0">
            <button
              type="button"
              aria-label={`Rename ${workspace.name}`}
              disabled={isRenaming}
              onClick={() => {
                isCancelledRef.current = false;
                setEditing(true);
              }}
              className="rounded-sm p-1 text-faint-foreground opacity-0 hover:bg-hover hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group-hover:opacity-100"
            >
              <Pencil size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        </div>
      )}
      <p className="text-xs text-faint-foreground">{SUBTITLE}</p>
    </div>
  );
};
