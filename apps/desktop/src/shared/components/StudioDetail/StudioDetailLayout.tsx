import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ResolvedDetailFields } from '../../detail-fields';
import { RailStack } from './RailStack';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly header: ReactNode;
  readonly rail?: ReactNode;
  readonly properties?: ResolvedDetailFields;
  readonly tabs?: ReactNode;
  readonly fit?: Fit;
  readonly children: ReactNode;
};

export const StudioDetailLayout = ({
  header,
  rail,
  properties,
  tabs,
  fit = 'fill',
  children,
}: Props) => {
  const isFlow = fit === 'flow';
  const hasProperties = properties != null && properties.length > 0;
  const hasRail = fit !== 'bleed' && (rail != null || hasProperties);

  return (
    <div className={cn('flex flex-col', isFlow ? 'gap-4' : 'h-full min-h-0')}>
      <div
        data-testid="detail-header-band"
        className={cn('flex shrink-0 flex-col', isFlow && 'sticky top-0 z-10 gap-4 bg-background')}
      >
        <div className={cn('flex flex-col gap-3', !isFlow && 'px-6 py-4')}>
          {header}
          {tabs}
        </div>
        <Divider />
      </div>
      <div className={cn('flex flex-col lg:flex-row', isFlow ? 'gap-4' : 'min-h-0 flex-1')}>
        {isFlow ? <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div> : null}
        {fit === 'bleed' ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        ) : null}
        {fit === 'fill' ? (
          <ScrollFade
            className="h-full min-h-0 min-w-0 flex-1"
            viewportClassName="px-6 py-6"
            fadeSize={24}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">{children}</div>
          </ScrollFade>
        ) : null}
        {hasRail ? (
          <div
            className={cn(
              'order-first flex shrink-0 flex-col lg:order-none lg:flex-row',
              !isFlow && 'min-h-0',
            )}
          >
            <RailStack rail={rail} properties={properties} isScrollable={!isFlow} />
            <Divider className="lg:hidden" />
          </div>
        ) : null}
      </div>
    </div>
  );
};
