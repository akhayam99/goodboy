import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import type { ResolvedDetailFields } from '../../detail-fields';
import { DetailProperties } from './DetailProperties';

type Props = {
  readonly rail: ReactNode;
  readonly properties?: ResolvedDetailFields;
  readonly isScrollable: boolean;
};

export const RailStack = ({ rail, properties, isScrollable }: Props) => {
  const hasProperties = properties != null && properties.length > 0;
  const extras = isScrollable ? (
    <ScrollFade className="order-3 max-h-64 lg:order-1 lg:max-h-none lg:flex-1" fadeSize={24}>
      {rail}
    </ScrollFade>
  ) : (
    <div className="order-3 lg:order-1">{rail}</div>
  );

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-4 lg:w-80',
        isScrollable && 'px-6 py-4 lg:h-full lg:min-h-0 lg:p-4',
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
  );
};
