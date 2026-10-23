import type { ReactNode } from 'react';
import { buttonClasses, cn, type ButtonSize, type ButtonVariant } from '@goodboy/ui';

type Props = {
  readonly href: string;
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
  readonly children: ReactNode;
};

export const DemoLink = ({ href, variant, size = 'md', className, children }: Props) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className={cn(buttonClasses({ variant, size }), className)}
  >
    {children}
  </a>
);
