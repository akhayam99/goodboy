import type { CSSProperties, ReactNode } from 'react';
import { Divider, ResizeHandle, ScrollFade, cn } from '@goodboy/ui';
import type { ResolvedDetailFields } from '../../detail-fields';
import { useColumnWidth } from '../../hooks/useColumnWidth';
import { STORAGE_KEYS } from '../../lib/storage-keys';
import { DetailProperties } from './DetailProperties';

type Props = {
  readonly rail: ReactNode;
  readonly properties?: ResolvedDetailFields;
  readonly isScrollable: boolean;
};

type Style = CSSProperties & {
  readonly '--studio-detail-rail-width': string;
};

const RAIL_INSET = 'px-6 py-4 lg:p-4';

export const RailStack = ({ rail, properties, isScrollable }: Props) => {
  const [width, setWidth] = useColumnWidth(STORAGE_KEYS.studioDetailRailWidth, 320);
  const hasProperties = properties != null && properties.length > 0;
  const style: Style = {
    '--studio-detail-rail-width': `${width}px`,
  };
  const stack = (
    <div className="flex flex-col gap-4">
      {rail != null ? <div className="min-w-0">{rail}</div> : null}
      {rail != null && hasProperties ? <Divider /> : null}
      {hasProperties ? <DetailProperties entries={properties} /> : null}
    </div>
  );

  return (
    <div className="flex w-full flex-col lg:w-auto lg:flex-row" style={style}>
      <div className="hidden h-full lg:block">
        <ResizeHandle
          value={width}
          min={260}
          max={560}
          onChange={setWidth}
          onReset={() => setWidth(320)}
          side="right"
          ariaLabel="Resize studio detail rail"
        />
      </div>
      {isScrollable ? (
        <ScrollFade
          className="w-full max-h-64 lg:max-h-none lg:w-[var(--studio-detail-rail-width)]"
          viewportClassName={RAIL_INSET}
          fadeSize={24}
        >
          {stack}
        </ScrollFade>
      ) : (
        <div className={cn('w-full lg:w-[var(--studio-detail-rail-width)]', RAIL_INSET)}>
          {stack}
        </div>
      )}
    </div>
  );
};
