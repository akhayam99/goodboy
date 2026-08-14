import type { ReactNode } from 'react';
import { cn } from '../cn';
import { SectionHeader } from './SectionHeader';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly variant?: 'framed' | 'frameless';
  readonly presentation?: 'widget' | 'section';
  readonly className?: string;
  readonly children: ReactNode;
};

export const StudioWidget = ({
  label,
  hint,
  icon,
  action,
  variant = 'framed',
  presentation = 'widget',
  className,
  children,
}: Props) => {
  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        presentation === 'widget' &&
          variant === 'framed' &&
          'rounded-lg border border-border-soft bg-muted/10 p-4',
        className,
      )}
    >
      <SectionHeader label={label} hint={hint} icon={icon} action={action} />
      {presentation === 'section' ? (
        <div
          className={cn(
            variant === 'framed' && 'rounded-lg border border-border-soft bg-muted/10 p-4',
          )}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
};
