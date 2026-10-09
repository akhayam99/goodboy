import { useAppStore } from '../../../../../store';

type Params = {
  readonly names: ReadonlyArray<string>;
};

export const keepScriptMounts = ({ names }: Params): void => {
  const sessionId = useAppStore.getState().currentSessionId;
  if (sessionId === null) {
    return;
  }
  useAppStore.setState((state) => ({
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [sessionId]: (state.sessionProjectMounts[sessionId] ?? []).filter((mount) =>
        names.includes(mount.mountName),
      ),
    },
  }));
};
