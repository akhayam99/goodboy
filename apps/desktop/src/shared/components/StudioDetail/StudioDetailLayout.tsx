import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import type { DetailEntry, ResolvedDetailFields } from '../../detail-fields';
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

const NO_PROPERTIES: ReadonlyArray<DetailEntry> = [];

export const StudioDetailLayout = ({
  header,
  rail,
  properties,
  tabs,
  fit = 'fill',
  children,
}: Props) => {
  const isFlow = fit === 'flow';
  const entries = properties ?? NO_PROPERTIES;
  const hasRail = rail != null || entries.length > 0;

  return (
    <div className={cn('flex flex-col', isFlow ? 'gap-4' : 'h-full min-h-0')}>
      <div className={cn('flex shrink-0 flex-col gap-3', !isFlow && 'px-6 py-4')}>
        {header}
        {tabs}
      </div>
      <Divider />
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
              isFlow ? 'gap-4' : 'min-h-0',
            )}
          >
            <Divider orientation="vertical" className="hidden lg:block" />
            {isFlow ? (
              <div className="w-full lg:w-72">
                <RailStack rail={rail} properties={entries} />
              </div>
            ) : (
              <ScrollFade
                className="w-full lg:h-full lg:w-72"
                viewportClassName="px-6 py-4 lg:p-4"
                fadeSize={24}
              >
                <RailStack rail={rail} properties={entries} />
              </ScrollFade>
            )}
            <Divider className="lg:hidden" />
          </div>
        ) : null}
      </div>
    </div>
  );
};
