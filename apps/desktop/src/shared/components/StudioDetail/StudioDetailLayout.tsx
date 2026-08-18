import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ResolvedDetailFields } from '../../detail-fields';
import { PANE_RHYTHM } from '@goodboy/ui';
import { DetailProperties } from './DetailProperties';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly header: ReactNode;
  readonly rail?: ReactNode;
  readonly dock?: ReactNode;
  readonly properties?: ResolvedDetailFields;
  readonly tabs?: ReactNode;
  readonly fit?: Fit;
  readonly children: ReactNode;
};

export const StudioDetailLayout = ({
  header,
  rail,
  dock,
  properties,
  tabs,
  fit = 'fill',
  children,
}: Props) => {
  const isFlow = fit === 'flow';
  const hasProperties = properties != null && properties.length > 0;
  const hasMeta = fit !== 'bleed' && (rail != null || hasProperties);
  const headerMeasure = PANE_RHYTHM.measure.pane;
  const bodyMeasure = fit === 'fill' ? PANE_RHYTHM.measure.pane : PANE_RHYTHM.measure.full;

  return (
    <div className={cn('flex flex-col', isFlow ? 'gap-4' : 'h-full min-h-0')}>
      <div
        data-testid="detail-header-band"
        className={cn('flex shrink-0 flex-col', isFlow && 'sticky top-0 z-10 gap-4 bg-background')}
      >
        <div className={cn('flex flex-col', !isFlow && PANE_RHYTHM.header)}>
          <div className={cn('flex flex-col gap-3', PANE_RHYTHM.column, headerMeasure)}>
            {header}
            {hasMeta ? (
              <div data-testid="detail-meta" className="flex min-w-0 flex-col gap-3">
                {hasProperties ? <DetailProperties entries={properties} /> : null}
                {rail != null ? <div className="min-w-0">{rail}</div> : null}
              </div>
            ) : null}
            {tabs}
          </div>
        </div>
        <Divider />
      </div>
      <div className={cn('flex min-w-0 flex-col', isFlow ? 'gap-4' : 'min-h-0 flex-1')}>
        {isFlow ? <div className={PANE_RHYTHM.stack}>{children}</div> : null}
        {fit === 'bleed' ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : null}
        {fit === 'fill' ? (
          <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
            <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.stack, bodyMeasure)}>{children}</div>
          </ScrollFade>
        ) : null}
        {dock != null ? <Divider /> : null}
        {dock != null ? (
          <div data-testid="detail-dock" className={cn('flex shrink-0 flex-col', PANE_RHYTHM.dock)}>
            <div className={cn('flex flex-col', PANE_RHYTHM.column, bodyMeasure)}>{dock}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
