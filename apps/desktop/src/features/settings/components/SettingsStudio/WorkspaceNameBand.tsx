import { useEffect, useRef, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, FieldRow, Input, useEscapeLayer } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceNameBand = ({ workspaceId }: Props) => {
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId) ?? null);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const reportError = useAppStore((s) => s.reportError);
  const name = workspace?.name ?? '';
  const [draft, setDraft] = useState(name);
  const [isRenaming, setRenaming] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isCancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEscapeLayer(() => {
    isCancelledRef.current = true;
    setDraft(name);
    inputRef.current?.blur();
  }, isEditing);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  if (workspace == null) {
    return null;
  }

  const commit = async () => {
    if (isCancelledRef.current) {
      isCancelledRef.current = false;
      return;
    }
    const next = draft.trim();
    if (next === '' || next === workspace.name) {
      setDraft(workspace.name);
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

  return (
    <Band
      inset="content"
      label="Workspace"
      ariaLabel="Workspace"
      hint="What this workspace works on, who you are, and how new sessions start."
      icon={<CONCEPT_ICONS.workspace size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <FieldRow label="Name" help="Shown in the switcher and on the settings home.">
        <Input
          type="text"
          value={draft}
          aria-label="Workspace name"
          placeholder={workspace.slug}
          maxLength={60}
          disabled={isRenaming}
          ref={inputRef}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-56"
        />
      </FieldRow>
    </Band>
  );
};
