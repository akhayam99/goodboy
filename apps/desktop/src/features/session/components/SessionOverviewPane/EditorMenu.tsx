import { useEffect, useMemo } from 'react';
import { formatError, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { Copy } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openInEditor } from '../../../../shared/lib/editor';
import { useToast } from '../../../../app/components/Toast';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { Density } from '../../density';

const REFERENCE_EDITORS = new Set(['code', 'cursor']);

const FULL_TRIGGER_BUTTON =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

const COMPACT_TRIGGER_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

type FolderTarget = {
  readonly name: string;
  readonly worktreePath: string;
};

type Props = {
  readonly sessionId: SessionId;
  readonly density?: Density;
  readonly target?: FolderTarget | null;
  readonly triggerClassName?: string;
};

export const EditorMenu = ({
  sessionId,
  density = 'full',
  target = null,
  triggerClassName,
}: Props) => {
  const sessionWorktreePath = useAppStore((s) => s.sessionWorktrees[sessionId]?.[0] ?? null);
  const worktreePath = target === null ? sessionWorktreePath : target.worktreePath;
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
              icon: CONCEPT_ICONS.folderOpen,
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
              icon: CONCEPT_ICONS.folderOpen,
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

  const densityTriggerClassName =
    density === 'compact' ? COMPACT_TRIGGER_BUTTON : FULL_TRIGGER_BUTTON;
  const label = target === null ? 'Open worktree' : `Open the folder of ${target.name}`;
  const tooltip =
    target === null
      ? 'Open the worktree in an editor, or copy its path'
      : `Open ${target.name} in an editor, or copy its path`;

  return (
    <OverflowMenu
      items={items}
      label={label}
      tooltip={tooltip}
      align="left"
      triggerClassName={triggerClassName ?? densityTriggerClassName}
      trigger={
        <>
          <CONCEPT_ICONS.folderOpen size={ICON_SIZE.row} aria-hidden />
          <span className="density-trigger-label" data-density={density}>
            Open
          </span>
        </>
      }
    />
  );
};
