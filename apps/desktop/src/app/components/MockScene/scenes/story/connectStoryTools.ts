import { useAppStore } from '../../../../../store';
import { storyBindingsOf } from './storyBindings';

export const connectStoryTools = (): void => {
  const { currentWorkspaceId } = useAppStore.getState();
  if (currentWorkspaceId === null) {
    return;
  }
  useAppStore.setState((state) => ({
    workspaceIntegrations: {
      ...state.workspaceIntegrations,
      [currentWorkspaceId]: [
        ...(state.workspaceIntegrations[currentWorkspaceId] ?? []),
        ...storyBindingsOf({ workspaceId: currentWorkspaceId }).filter(
          (binding) => binding.provider === 'gitlab',
        ),
      ],
    },
  }));
};
