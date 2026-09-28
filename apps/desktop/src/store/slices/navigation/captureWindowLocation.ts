import type { AppState } from '../../types';
import { captureLocation } from './captureLocation';
import { currentStack } from './currentStack';
import type { Location } from './types';

export const captureWindowLocation = ({ state }: { readonly state: AppState }): Location => {
  const stack = currentStack(state);
  return stack.entries[stack.index] ?? captureLocation({ state });
};
