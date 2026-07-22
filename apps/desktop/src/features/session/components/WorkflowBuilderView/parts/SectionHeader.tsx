import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly htmlFor?: string;
  readonly children?: ReactNode;
};

const SECTION_LABEL_CLS =
  'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70';

export const SectionHeader = ({ icon: Icon, label, htmlFor, children }: Props) => (
  <div className="flex items-center gap-2">
    {htmlFor ? (
      <label htmlFor={htmlFor} className={SECTION_LABEL_CLS}>
        <Icon size={11} aria-hidden /> {label}
      </label>
    ) : (
      <span className={SECTION_LABEL_CLS}>
        <Icon size={11} aria-hidden /> {label}
      </span>
    )}
    {children ? (
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">{children}</div>
    ) : null}
  </div>
);
