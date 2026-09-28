import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly children: ReactNode;
};

export const StorageCluster = ({ id, title, hint, icon: Icon, tone, children }: Props) => {
  const tint = tintClasses(tone);
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
            tint.bg,
            tint.icon,
          )}
        >
          <Icon size={ICON_SIZE.row} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-heading text-foreground">
            {title}
          </h2>
          <p className="text-secondary text-faint-foreground">{hint}</p>
        </div>
      </header>
      <div className={cn('flex flex-col gap-8 border-l-2 pl-4', tint.border)}>{children}</div>
    </section>
  );
};
