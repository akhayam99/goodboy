import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import { currentStack } from '../../store/slices/navigation/currentStack';

type Params = {
  readonly sessionId: SessionId;
  readonly lens: LensKind;
  readonly rows: Readonly<Record<string, string>>;
  readonly mountPath?: string | null;
};

export const openPlaceRows = ({ sessionId, lens, rows, mountPath }: Params): void => {
  const state = useAppStore.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens, mountPath }) });
  const landed = useAppStore.getState();
  const stack = currentStack(landed);
  const kept = stack.entries[stack.index]?.focus.returnRows;
  landed.amendFocus({ patch: { returnRows: { ...kept, ...rows } } });
};
