import type { FileDiff, SessionId } from '@goodboy/types';
import { useMemo } from 'react';
import { usePendingAction } from '../../shared/hooks/usePendingAction';
import { openFileInWorkspace } from '../../shared/lib/editor';
import { resolveEditorBinary } from '../../shared/lib/editorSettings';
import { useAppStore } from '../../store';
import { DiffView } from './components/DiffView';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly sessionId: SessionId;
  readonly copyPath: string;
};

export const HistoryChangeDiff = ({ files, sessionId, copyPath }: Props) => {
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const { run } = usePendingAction({ sessionId });
  const fileActions = useMemo(
    () => ({
      onOpenInEditor: (filePath: string) => {
        void run({
          key: `open-editor:${filePath}`,
          failureTitle: "Couldn't open the copied file.",
          task: () =>
            openFileInWorkspace({
              workspacePath: copyPath,
              filePath: `${copyPath}/${filePath}`,
              editor,
            }),
        });
      },
    }),
    [copyPath, editor, run],
  );
  return <DiffView files={files} presentation="peek" fileActions={fileActions} />;
};
