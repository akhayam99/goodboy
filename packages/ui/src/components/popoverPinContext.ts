import { createContext } from 'react';

export const PopoverPinContext = createContext<{
  readonly start: HTMLElement | null;
  readonly end: HTMLElement | null;
} | null>(null);
