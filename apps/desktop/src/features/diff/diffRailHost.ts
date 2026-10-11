import { createContext } from 'react';

export type DiffRailHost = {
  readonly host: HTMLElement | null;
  readonly isOverlay: boolean;
  readonly open: () => void;
  readonly dismiss: () => void;
};

const noop = (): void => undefined;

export const DiffRailContext = createContext<DiffRailHost>({
  host: null,
  isOverlay: false,
  open: noop,
  dismiss: noop,
});
