import { useAppStore } from '../../store';

type Params = Record<never, never>;

export const leaveToolPage = ({}: Params): void => {
  useAppStore.getState().amendStudio({ studio: { kind: 'connections', focus: null } });
};
