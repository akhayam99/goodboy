import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import {
  IntegrationGlyph,
  type IntegrationGlyphProvider,
} from '../../../features/integrations/components/IntegrationGlyph';

type IconLeading = {
  readonly kind: 'icon';
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
};

type GlyphLeading = {
  readonly kind: 'glyph';
  readonly provider: IntegrationGlyphProvider;
};

type LinkedWorkRowLeading = IconLeading | GlyphLeading;

type Props = {
  readonly leading: LinkedWorkRowLeading;
  readonly identifier: string;
  readonly title?: string;
  readonly onClick: () => void;
  readonly ariaLabel?: string;
  readonly tooltip?: string;
  readonly actions?: ReactNode;
};

export const LinkedWorkRow = ({
  leading,
  identifier,
  title,
  onClick,
  ariaLabel,
  tooltip,
  actions,
}: Props) => {
  const glyph =
    leading.kind === 'icon' ? (
      <span
        role="img"
        aria-label={leading.label}
        className={cn('shrink-0', tintClasses(leading.tone).icon)}
      >
        <leading.icon size={14} aria-hidden />
      </span>
    ) : (
      <IntegrationGlyph provider={leading.provider} size="sm" />
    );

  return (
    <div className="group flex w-full items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 shadow-sm transition-colors hover:border-border">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        title={tooltip}
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        {glyph}
        <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
          {identifier}
        </span>
        {title != null ? (
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{title}</span>
        ) : null}
        <ArrowRight
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      </button>
      {actions}
    </div>
  );
};
