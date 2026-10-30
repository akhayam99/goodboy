import { Fragment } from 'react';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import type { StartSettingItem } from './startSettingsOf';

type Props = {
  readonly items: ReadonlyArray<StartSettingItem>;
};

export const StartSettingsRow = ({ items }: Props) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label={START_KIND_COPY.settings}
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      {items.map((item) => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
    </div>
  );
};
