import type { ComponentPropsWithoutRef } from 'react';

type Props = ComponentPropsWithoutRef<'div'>;

export const BootCover = ({ className = '', ...rest }: Props) => (
  <div className={`bg-backdrop-cover text-foreground ${className}`} {...rest} />
);
