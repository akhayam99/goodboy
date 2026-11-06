import { InboxSourceGlyph } from './InboxSourceGlyph';
import type { InboxItem } from './InboxItem';
import { AppRow, RecordState } from './kit';

type Props = {
  readonly item: InboxItem;
};

export const InboxItemRow = ({ item }: Props) => (
  <AppRow isSelected={item.isSelected} className="ibxRow" innerClassName="ibxRowInner">
    <span className="ibxDot" data-on={item.hasSession ? '' : undefined} aria-hidden />
    <span className="ibxGlyph" aria-hidden>
      <InboxSourceGlyph id={item.source} size={14} />
    </span>
    <span className="ibxId">{item.id}</span>
    <span className="ibxTitle" data-done={item.category === 'done' ? '' : undefined}>
      {item.title}
    </span>
    <span className="ibxContext">{item.context}</span>
    <RecordState category={item.category} label={item.state} className="ibxState" />
    <span className="ibxAge">{item.age}</span>
  </AppRow>
);
