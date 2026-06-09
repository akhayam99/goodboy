import type { ReactNode } from 'react';
import { Divider, cn } from '@goodboy/ui';
import { ScrollFade } from '../../../../shared/components/ScrollFade';

type Props = {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly maxWidthClass?: string;
  readonly children: ReactNode;
};

export const PanelShell = ({
  icon,
  title,
  subtitle,
  action,
  maxWidthClass = 'max-w-3xl',
  children,
}: Props) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-8 py-4">
        {icon ?? null}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-foreground">{title}</span>
          {subtitle ? (
            <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <Divider />
      <div className="min-h-0 flex-1">
        <ScrollFade className={cn('mx-auto h-full px-10 py-8', maxWidthClass)}>
          <div className="flex flex-col gap-8">{children}</div>
        </ScrollFade>
      </div>
    </div>
  );
};
