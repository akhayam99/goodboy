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

export const RailStack = ({ rail, properties, isScrollable }: Props) => {
  const [width, setWidth] = useColumnWidth(STORAGE_KEYS.studioDetailRailWidth, 320);
  const hasProperties = properties != null && properties.length > 0;
  const style: Style = {
    '--studio-detail-rail-width': `${width}px`,
  };
  const extras = isScrollable ? (
    <ScrollFade className="order-3 max-h-64 lg:order-1 lg:max-h-none lg:flex-1" fadeSize={24}>
      {rail}
    </ScrollFade>
  ) : (
    <div className="order-3 lg:order-1">{rail}</div>
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
          ariaLabel="resize studio detail rail"
        />
      </div>
      <div
        className={cn(
          'flex w-full flex-col gap-4 px-6 py-4 lg:w-[var(--studio-detail-rail-width)] lg:p-4',
          isScrollable && 'lg:h-full lg:min-h-0',
        )}
      >
        {rail != null ? extras : null}
        {rail != null && hasProperties ? <Divider className="order-2" /> : null}
        {hasProperties ? (
          <div className="order-1 shrink-0 lg:order-3">
            <DetailProperties entries={properties} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
