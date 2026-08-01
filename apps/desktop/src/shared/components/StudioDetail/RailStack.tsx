import type { ReactNode } from 'react';
import { Divider } from '@goodboy/ui';
import type { DetailEntry } from '../../detail-fields';
import { DetailProperties } from './DetailProperties';

type Props = {
  readonly rail: ReactNode;
  readonly properties: ReadonlyArray<DetailEntry>;
};

export const RailStack = ({ rail, properties }: Props) => {
  const hasProperties = properties.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {rail != null ? <div className="order-3 lg:order-1">{rail}</div> : null}
      {rail != null && hasProperties ? <Divider className="order-2" /> : null}
      {hasProperties ? (
        <div className="order-1 lg:order-3">
          <DetailProperties entries={properties} />
        </div>
      ) : null}
    </div>
  );
};
