import './CardRow.css';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type CardRowItem = {
  readonly key: string;
  readonly media?: ReactNode;
  readonly title: string;
  readonly caption: ReactNode;
};

type Props = {
  readonly label: string;
  readonly columns?: 2 | 3 | 4;
  readonly mediaRatio?: string;
  readonly hasDots?: boolean;
  readonly items: readonly CardRowItem[];
};

type RowStyle = CSSProperties & {
  readonly '--cols': number;
  readonly '--ratio'?: string;
};

export const CardRow = ({ label, columns = 2, mediaRatio, hasDots = false, items }: Props) => {
  const style: RowStyle = { '--cols': columns, '--ratio': mediaRatio };
  const listRef = useRef<HTMLUListElement | null>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const list = listRef.current;
    const first = list?.firstElementChild;
    if (list === null || !(first instanceof HTMLElement)) {
      return;
    }
    const step = first.offsetWidth + parseFloat(getComputedStyle(list).columnGap || '0');
    setActive(Math.min(items.length - 1, Math.max(0, Math.round(list.scrollLeft / step))));
  };

  const list = (
    <ul
      className="cardRow"
      style={style}
      aria-label={label}
      ref={listRef}
      onScroll={hasDots ? onScroll : undefined}
    >
      {items.map((item) => (
        <li className="cardRowItem" key={item.key}>
          <div className={mediaRatio === undefined ? 'cardRowMedia' : 'cardRowMedia ratio'}>
            {item.media}
          </div>
          <h3 className="cardRowTitle">{item.title}</h3>
          <div className="cardRowCaption">{item.caption}</div>
        </li>
      ))}
    </ul>
  );

  if (!hasDots) {
    return list;
  }

  return (
    <div className="cardRowWrap" data-reveal="">
      {list}
      <span className="cardRowDots" aria-hidden="true">
        {items.map((item, index) => (
          <span key={item.key} className="cardRowDot" data-active={index === active} />
        ))}
      </span>
    </div>
  );
};
