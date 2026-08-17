import { Unplug } from 'lucide-react';
import { KbdPill, Skeleton, StatusDot, cn, tintClasses } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import { shortcutGlyphs } from '../../../../../../shared/keyboard/registry';
import { SummarizerWorkingIndicator } from '../../../SummarizerWorkingIndicator';
import { LENS_SHORTCUTS, type LensRow } from './groups';
import { rowsWantAttention } from './attention';

type Props = {
  readonly row: LensRow;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

export const LensNavRow = ({ row, isActive, onSelect }: Props) => {
  const wantsAttention = rowsWantAttention({ rows: [row] });
  const shortcut = shortcutGlyphs(LENS_SHORTCUTS[row.kind]);
  const hasDiffstat = row.diffstat != null && row.diffstat.additions + row.diffstat.deletions > 0;
  const hasBadge =
    row.isCountLoading === true ||
    hasDiffstat ||
    (row.count != null && row.count > 0) ||
    row.dot != null ||
    row.secondaryDot === true ||
    row.isConnected === false;
  const glyphRowLabel =
    row.isCountLoading !== true && row.count != null && row.count > 0
      ? `${row.label} ${row.count}`
      : row.label;
  const iconEmphasis = cn(
    isActive && 'opacity-100',
    !isActive && wantsAttention ? 'opacity-90' : null,
    !isActive && !wantsAttention ? 'opacity-55 group-hover:opacity-80' : null,
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={row.glyph != null ? glyphRowLabel : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md text-left transition-colors',
        PANE_RHYTHM.navRail.row,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        row.isConnected === false && 'opacity-40 hover:opacity-70',
      )}
    >
      {row.glyph != null ? (
        <span
          className={cn(
            'flex w-5 flex-none items-center justify-center transition-[color,opacity]',
            iconEmphasis,
          )}
        >
          <IntegrationGlyph
            provider={row.glyph}
            size={14}
            useBrandColor={row.isConnected !== false}
          />
        </span>
      ) : null}
      {row.glyph == null && row.icon != null ? (
        <span
          className={cn(
            'flex w-5 flex-none items-center justify-center transition-[color,opacity]',
            tintClasses(row.tone ?? 'neutral').icon,
            iconEmphasis,
          )}
        >
          <row.icon size={14} aria-hidden />
        </span>
      ) : null}
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          !hasBadge && 'pr-12',
          isActive && 'font-medium',
        )}
      >
        {row.label}
      </span>
      {hasBadge ? (
        <span
          className={cn(
            'flex min-w-10 shrink-0 items-center justify-end gap-1.5 transition-opacity',
            'group-hover:opacity-0 group-focus-visible:opacity-0',
          )}
        >
          {row.isCountLoading === true ? (
            <span data-testid={`lens-count-loading-${row.kind}`}>
              <Skeleton className="h-4 w-6 rounded-full" />
            </span>
          ) : (
            <>
              {hasDiffstat && row.diffstat != null ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium tabular-nums">
                  <span className="text-success">+{row.diffstat.additions}</span>
                  <span className="text-danger">-{row.diffstat.deletions}</span>
                </span>
              ) : row.count != null && row.count > 0 ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  {row.secondaryDot ? (
                    <StatusDot
                      tone="accent"
                      size="sm"
                      ariaLabel={row.secondaryDotLabel ?? row.label}
                    />
                  ) : null}
                  {row.dot === 'running' ? (
                    <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" />
                  ) : null}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-2xs font-medium tabular-nums',
                      row.dot === 'attention'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {row.count}
                  </span>
                </span>
              ) : row.kind === 'context' && row.dot === 'running' ? (
                <SummarizerWorkingIndicator />
              ) : row.dot ? (
                <StatusDot
                  tone={row.dot === 'attention' ? 'warning' : 'info'}
                  size="sm"
                  pulsing={row.dot === 'running'}
                  ariaLabel={row.dot === 'attention' ? 'Needs attention' : 'Running'}
                />
              ) : row.secondaryDot ? (
                <StatusDot tone="accent" size="sm" ariaLabel={row.secondaryDotLabel ?? row.label} />
              ) : null}
              {row.isConnected === false ? (
                <span
                  aria-hidden
                  title={`${row.label} disconnected`}
                  className="flex shrink-0 items-center text-muted-foreground"
                >
                  <Unplug size={12} />
                </span>
              ) : null}
            </>
          )}
        </span>
      ) : null}
      <KbdPill
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-3xs opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
      >
        {shortcut}
      </KbdPill>
    </button>
  );
};
