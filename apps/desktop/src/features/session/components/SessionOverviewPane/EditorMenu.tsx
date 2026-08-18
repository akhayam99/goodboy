import { useEffect, useMemo } from 'react';
import { formatError, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { Copy, FolderOpen } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import { useToast } from '../../../../app/components/Toast';
import type { Density } from '../../density';

const REFERENCE_EDITORS = new Set(['code', 'cursor']);

const FULL_TRIGGER_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const COMPACT_TRIGGER_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type Props = {
  readonly sessionId: SessionId;
  readonly density?: Density;
};

export const EditorMenu = ({ sessionId, density = 'full' }: Props) => {
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
            ...refEditors.map((ed): OverflowMenuItem => ({
              kind: 'item',
              key: `editor-${ed.binary}`,
              label: ed.label,
              icon: FolderOpen,
              onClick: () => void launchEditor(ed.binary),
              disabled: worktreePath == null,
            })),
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

  const triggerClassName = density === 'compact' ? COMPACT_TRIGGER_BUTTON : FULL_TRIGGER_BUTTON;

  return (
    <OverflowMenu
      items={items}
      label="Open worktree"
      tooltip="Open the worktree in an editor, or copy its path"
      align="left"
      triggerClassName={triggerClassName}
      trigger={
        <>
          <FolderOpen size={13} aria-hidden />
          <span className="density-trigger-label" data-density={density}>
            Open
          </span>
        </>
      }
    />
  );
};
