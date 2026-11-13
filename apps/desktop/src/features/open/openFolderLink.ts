import { openInEditor } from '../../shared/lib/editor';
import { resolveEditorBinary } from '../../shared/lib/editorSettings';
import { revealInFileManager } from '../../shared/lib/reveal';
import { useAppStore } from '../../store';
import { resolveExploreEditor } from '../explore/resolveExploreEditor';

type Params = {
  readonly path: string;
  readonly editor: string | null;
};

export const openFolderLink = async ({ path, editor }: Params): Promise<void> => {
  if (editor !== null) {
    await openInEditor({ path, editor });
    return;
  }
  if (useAppStore.getState().detectedEditors.length === 0) {
    await useAppStore.getState().loadDetectedEditors();
  }
  const state = useAppStore.getState();
  const resolved = resolveExploreEditor({
    configured: resolveEditorBinary({ settings: state.settings }),
    detected: state.detectedEditors,
  });
  if (resolved === null) {
    await revealInFileManager({ path });
    return;
  }
  await openInEditor({ path, editor: resolved.binary });
};
