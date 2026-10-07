import type { ComponentProps } from 'react';
import { Kbd } from './Kbd';

export type KbdPillProps = ComponentProps<'kbd'>;

export const KbdPill = (props: KbdPillProps) => {
  return <Kbd look="cap" {...props} />;
};
