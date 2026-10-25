import { useCallback } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
};

export const useOpenDiffFileInEditor = ({
  sessionId,
  workingDir,
}: Params): ((filePath: string) => Promise<void>) => {
  const editorBinary = useAppStore((s) => resolveEditorBinary({ settings: s.settings }));
  const emitNotification = useAppStore((s) => s.emitNotification);

  return useCallback(
    async (filePath: string) => {
      if (workingDir === null) {
        return;
      }
      const root = workingDir.replace(/\/$/, '');
      try {
        await openFileInWorkspace({
          workspacePath: root,
          filePath: `${root}/${filePath}`,
          editor: editorBinary,
        });
      } catch (err) {
        void emitNotification({
          kind: 'error',
          severity: 'error',
          title: "Couldn't open the file in your editor",
          body: formatError(err),
          sessionId,
        });
      }
    },
    [editorBinary, emitNotification, sessionId, workingDir],
  );
};
