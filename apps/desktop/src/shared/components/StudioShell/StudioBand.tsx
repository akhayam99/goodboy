import type { ReactNode } from 'react';
import { cn, Divider, tintClasses, type Tone } from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';

type Props = {
  readonly crumbKey: string;
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly accessory?: ReactNode;
  readonly onClose: () => void;
};

export const StudioBand = ({
  crumbKey,
  icon: Icon,
  tone = 'primary',
  glyph,
  title,
  subtitle,
  closeLabel,
  accessory,
  onClose,
}: Props) => (
  <>
    <header
      aria-label={title}
      data-studio-band=""
      className="flex h-10 shrink-0 items-center gap-3 px-6"
    >
      <span key={crumbKey} className="flex min-w-0 items-center gap-2 motion-safe:animate-fade-in">
        {glyph ??
          (Icon != null ? (
            <Icon size={16} className={cn('shrink-0', tintClasses(tone).icon)} aria-hidden />
          ) : null)}
        <span className="shrink-0 text-heading text-foreground">{title}</span>
        {subtitle != null && subtitle !== '' ? (
          <span className="truncate text-secondary text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <div className="flex-1" />
      {accessory}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-2.5',
          'text-label text-muted-foreground transition-colors',
          'hover:bg-hover hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <X size={13} aria-hidden /> Done
      </button>
    </header>
    <Divider />
  </>
);
