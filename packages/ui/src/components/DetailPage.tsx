import { useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { Collapsible } from './Collapsible';
import { Divider } from './Divider';
import { ScrollFade } from './ScrollFade';

export type DetailSection = {
  readonly id: string;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly defaultCollapsed?: boolean;
};

type Props = {
  readonly title: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly state?: ReactNode;
  readonly actions?: ReactNode;
  readonly meta?: ReactNode;
  readonly sections: ReadonlyArray<DetailSection>;
  readonly footer?: ReactNode;
  readonly className?: string;
};

export const DetailPage = ({
  title,
  eyebrow,
  state,
  actions,
  meta,
  sections,
  footer,
  className,
}: Props) => {
  const [collapsed, setCollapsed] = useState<ReadonlyArray<string>>(
    sections.filter((section) => section.defaultCollapsed === true).map((section) => section.id),
  );

  const toggle = (id: string, open: boolean) => {
    setCollapsed((current) => (open ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="sticky top-0 z-10 flex shrink-0 flex-col bg-background">
        <div className="flex min-w-0 items-start justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            {eyebrow != null && (
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                {eyebrow}
              </span>
            )}
            <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {state}
            {actions}
          </div>
        </div>
        <Divider />
      </div>

      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        <div className="flex flex-col gap-3">
          {meta}
          {sections.map((section, index) => (
            <div key={section.id} className="flex flex-col gap-2">
              {(index > 0 || meta != null) && <Divider />}
              <Collapsible
                open={!collapsed.includes(section.id)}
                onOpenChange={(open) => toggle(section.id, open)}
                trigger={section.title}
              >
                {section.children}
              </Collapsible>
            </div>
          ))}
        </div>
      </ScrollFade>

      {footer != null && (
        <div className="flex shrink-0 flex-col">
          <Divider />
          <div className="px-3 py-2">{footer}</div>
        </div>
      )}
    </div>
  );
};
