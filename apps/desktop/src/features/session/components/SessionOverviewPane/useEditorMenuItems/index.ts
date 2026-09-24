import { useEffect, useMemo } from 'react';
import { useCopyLink, type OverflowMenuItem } from '@goodboy/ui';
import { Copy } from 'lucide-react';
import { useAppStore } from '../../../../../store';
import { openInEditor } from '../../../../../shared/lib/editor';
import { useToast } from '../../../../../app/components/Toast';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

const REFERENCE_EDITORS = new Set(['code', 'cursor']);

type Params = {
  readonly worktreePath: string | null;
};

type LaunchEditorParams = {
  readonly binary: string;
};

export const useEditorMenuItems = ({ worktreePath }: Params): ReadonlyArray<OverflowMenuItem> => {
  const detectedEditors = useAppStore((state) => state.detectedEditors);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const { failedKey, copy } = useCopyLink();

  useEffect(() => {
    if (detectedEditors.length > 0) {
      return;
    }
    void loadDetectedEditors();
  }, []);

  useEffect(() => {
    if (failedKey === null) {
      return;
    }
    showToast({ kind: 'warning', message: "Couldn't copy the path." });
  }, [failedKey, showToast]);

  return useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const launchEditor = async ({ binary }: LaunchEditorParams) => {
      if (worktreePath === null) {
        return;
      }
      try {
        await openInEditor(worktreePath, binary);
      } catch (error) {
        void reportError({ title: "Couldn't open the editor", error });
      }
    };
    const referenceEditors = detectedEditors.filter((editor) =>
      REFERENCE_EDITORS.has(editor.binary),
    );
    const editorItems: ReadonlyArray<OverflowMenuItem> =
      referenceEditors.length === 0
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
            ...referenceEditors.map((editor): OverflowMenuItem => ({
              kind: 'item',
              key: `editor-${editor.binary}`,
              label: editor.label,
              icon: CONCEPT_ICONS.folderOpen,
              onClick: () => void launchEditor({ binary: editor.binary }),
              disabled: worktreePath === null,
            })),
          ];
    return [
      ...editorItems,
      {
        kind: 'item',
        key: 'copy-path',
        label: 'Copy path',
        icon: Copy,
        onClick: () => {
          if (worktreePath === null) {
            return;
          }
          void copy({ text: worktreePath });
        },
        disabled: worktreePath === null,
      },
    ];
  }, [copy, detectedEditors, reportError, worktreePath]);
};
