import { Fragment, useContext, type ReactNode } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import { FactDot } from '../../../../shared/components/SettingChip/FactDot';
import { SettingLookContext } from '../../../../shared/components/SettingChip/settingLookContext';
import type { Glance } from '../../glance/glanceOf';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { HeadSlotPortal } from '../HeadSlotPortal';

type Props = {
  readonly glance: Glance;
  readonly spend: string | null;
  readonly spendTotal?: string | null;
  readonly settings: ReactNode;
  readonly isStateShown?: boolean;
  readonly isInHead?: boolean;
  readonly trailing?: ReactNode;
  readonly leading?: ReactNode;
};

export const RunGlanceLine = ({
  glance,
  spend,
  spendTotal = null,
  settings,
  isStateShown = true,
  isInHead = false,
  trailing = null,
  leading = null,
}: Props) => {
  const slots = useContext(SessionHeadSlotsContext);
  const isHeadRow = isInHead && slots !== null;
  const tint = tintClasses(glance.tone);

  const row = (
    <div
      data-glance={glance.state}
      data-glance-place={isHeadRow ? 'head' : 'page'}
      className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-meta"
    >
      {leading}
      {isStateShown ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            tint.dot,
            glance.isLive && 'motion-safe:animate-soft-pulse',
          )}
        />
      ) : null}
      <span
        role="status"
        aria-live="polite"
        className="flex min-w-0 items-center gap-2 empty:hidden"
      >
        {isStateShown ? (
          <span
            className={cn(
              'shrink-0',
              isHeadRow ? 'text-meta text-muted-foreground' : cn('text-row', tint.text),
            )}
          >
            {glance.word}
          </span>
        ) : null}
        {glance.sentence === '' ? null : (
          <>
            {isStateShown ? <FactDot /> : null}
            <span className="min-w-0 truncate text-muted-foreground">{glance.sentence}</span>
          </>
        )}
      </span>
      {[spend, spendTotal].map((figure) =>
        figure === null ? null : (
          <Fragment key={figure}>
            <FactDot />
            <span className="shrink-0 tabular-nums text-faint-foreground">{figure}</span>
          </Fragment>
        ),
      )}
      {settings === null ? null : (
        <SettingLookContext.Provider value="fact">{settings}</SettingLookContext.Provider>
      )}
      {trailing === null ? null : (
        <>
          <span className="flex-1" />
          <span data-glance-actions="" className="flex shrink-0 items-center gap-1">
            {trailing}
          </span>
        </>
      )}
    </div>
  );

  if (isHeadRow) {
    return <HeadSlotPortal slot="meta">{row}</HeadSlotPortal>;
  }
  return row;
};
