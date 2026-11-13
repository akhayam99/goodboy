import { useAppStore } from '../../../../../store';
import { browserWrites } from '../../../../../store/slices/browser/browserWrites';

export const holdBrowserTabCount = (): (() => void) => {
  const workspaceId = useAppStore.getState().currentWorkspaceId;
  if (workspaceId === null) {
    return () => undefined;
  }
  const key = browserWrites.workspaceLoadKey({ workspaceId });
  useAppStore.setState({ browserTabCounts: {}, browserTabCountFailures: {} });
  browserWrites.workspaceReads.set(key, new Promise<void>(() => undefined));
  return () => {
    browserWrites.workspaceReads.delete(key);
  };
};
