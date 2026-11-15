import { useAppStore } from '../../store';
import type { ConnectionsFocus } from './connectionsFocus';

type Params = {
  readonly focus: ConnectionsFocus | null;
  readonly isUp?: boolean;
};

export const openConnection = ({ focus, isUp = false }: Params): void => {
  const state = useAppStore.getState();
  if (isUp) {
    state.amendStudio({ studio: { kind: 'connections', focus } });
    return;
  }
  state.openStudio({ studio: { kind: 'connections', focus } });
};
