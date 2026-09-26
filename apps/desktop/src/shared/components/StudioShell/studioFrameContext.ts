import { createContext, useContext, type ReactNode } from 'react';
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

export type StudioFrameHandle = {
  readonly setChrome: (chrome: StudioChrome | null) => void;
  readonly requestClose: () => void;
};

export const StudioFrameContext = createContext<StudioFrameHandle | null>(null);

export const useStudioFrame = (): StudioFrameHandle | null => useContext(StudioFrameContext);
