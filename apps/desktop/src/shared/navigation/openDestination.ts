import { useAppStore } from '../../store';
import { destinationStudioOf } from '../../store/slices/navigation/destinationStudioOf';
import type { StudioDestinationId } from './destinations';

type Params = {
  readonly id: StudioDestinationId;
};

export const openDestination = ({ id }: Params): void => {
  const state = useAppStore.getState();
  state.switchStudio({ studio: destinationStudioOf({ id, state }) });
};
