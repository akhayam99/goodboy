import { useEffect, useMemo } from 'react';
import { Copy, FolderOpen } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

const REFERENCE_EDITORS = new Set(['code', 'cursor']);

const TRIGGER_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly sessionId: SessionId;
};

export const EditorMenu = ({ sessionId }: Props) => {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[sessionId]?.[0] ?? null);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const { showToast } = useToast();

  useEffect(() => {
    if (detectedEditors.length > 0) {
      return;
    }
    void loadDetectedEditors();
  }, []);

  const launchEditor = async (binary: string) => {
    if (worktreePath == null) {
      return;
    }
    try {
      await openInEditor(worktreePath, binary);
    } catch (err) {
      showToast('error', `couldn't open editor: ${formatError(err)}`);
    }
  };

  const copyPath = async () => {
    if (worktreePath == null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(worktreePath);
      showToast('success', 'worktree path copied');
    } catch (err) {
      showToast('error', `couldn't copy path: ${formatError(err)}`);
    }
  };

  const items = useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const refEditors = detectedEditors.filter((ed) => REFERENCE_EDITORS.has(ed.binary));
    const editorItems: ReadonlyArray<OverflowMenuItem> =
      refEditors.length === 0
        ? [
            {
              kind: 'item',
              key: 'no-editor',
              label: 'No editor detected',
              icon: FolderOpen,
              onClick: () => undefined,
              disabled: true,
            },
          ]
        : [
            { kind: 'header', key: 'editor-header', label: 'Open in editor' },
            ...refEditors.map(
              (ed): OverflowMenuItem => ({
                kind: 'item',
                key: `editor-${ed.binary}`,
                label: ed.label,
                icon: FolderOpen,
                onClick: () => void launchEditor(ed.binary),
                disabled: worktreePath == null,
              }),
            ),
          ];
    return [
      ...editorItems,
      { kind: 'separator', key: 'path-sep' },
      {
        kind: 'item',
        key: 'copy-path',
        label: 'Copy path',
        icon: Copy,
        onClick: () => void copyPath(),
        disabled: worktreePath == null,
      },
    ];
  }, [detectedEditors, worktreePath]);

  return (
    <OverflowMenu
      items={items}
      label="open worktree"
      align="left"
      side="top"
      triggerClassName={TRIGGER_BUTTON}
      trigger={
        <>
          <FolderOpen size={13} aria-hidden />
          <span>Open</span>
        </>
      }
    />
  );
};
