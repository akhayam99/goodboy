import type { ComponentProps } from 'react';
import { Kbd } from './Kbd';

export type KbdPillProps = Omit<ComponentProps<'kbd'>, 'className'> & {
  readonly onTone?: boolean;
};

export const KbdPill = (props: KbdPillProps) => {
  return <Kbd look="cap" {...props} />;
};
