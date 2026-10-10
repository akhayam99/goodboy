import { createContext, useContext, type ReactNode, type Ref } from 'react';
import type { Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';

export type StudioChrome = {
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly accessory?: ReactNode;
  readonly isEscapeEnabled: boolean;
};

export type StudioDrawerSpec = {
  readonly node: ReactNode | null;
  readonly drawerKey?: string;
  readonly ariaLabel: string;
  readonly resizeLabel: string;
  readonly drawerRef?: Ref<HTMLElement>;
};

export type StudioFrameHandle = {
  readonly setDrawer: ((spec: StudioDrawerSpec | null) => void) | null;
  readonly setChrome: (chrome: StudioChrome | null) => void;
  readonly requestClose: () => void;
  readonly trailSlot: HTMLElement | null;
  readonly claimTrail: () => () => void;
};

export const StudioFrameContext = createContext<StudioFrameHandle | null>(null);

export const useStudioFrame = (): StudioFrameHandle | null => useContext(StudioFrameContext);
