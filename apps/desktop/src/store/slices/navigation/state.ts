import type { NavigationStack } from './types';
import type { StudioPlace } from './studio';

export type NavigationSliceState = {
  readonly navigation: Readonly<Record<string, NavigationStack>>;
  readonly appStudio: StudioPlace | null;
};

export const navigationInitialState: NavigationSliceState = { navigation: {}, appStudio: null };
