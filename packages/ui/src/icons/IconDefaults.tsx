import type { ReactNode } from 'react';
import { IconContext } from '@phosphor-icons/react/dist/lib/context';
import type { IconProps } from '@phosphor-icons/react/dist/lib/types';

type Props = {
  readonly children: ReactNode;
};

const ICON_DEFAULTS = {
  size: 24,
  weight: 'regular',
  color: 'currentColor',
  mirrored: false,
  'aria-hidden': true,
} as const satisfies IconProps;

export const IconDefaults = ({ children }: Props) => (
  <IconContext.Provider value={ICON_DEFAULTS}>{children}</IconContext.Provider>
);
