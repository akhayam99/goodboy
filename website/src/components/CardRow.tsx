import './CardRow.css';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type CardRowItem = {
  readonly key: string;
  readonly media?: ReactNode;
  readonly title: string;
  readonly caption: ReactNode;
};

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

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

  const readStep = (list: HTMLUListElement) => {
    const first = list.firstElementChild;
    if (!(first instanceof HTMLElement)) {
      return 0;
    }
    return first.offsetWidth + parseFloat(getComputedStyle(list).columnGap || '0');
  };

  const onScroll = () => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    const step = readStep(list);
    if (step === 0) {
      return;
    }
    setActive(Math.min(items.length - 1, Math.max(0, Math.round(list.scrollLeft / step))));
  };

  const scrollToCard = (index: number) => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    const isReduced = window.matchMedia(REDUCED_QUERY).matches;
    list.scrollTo({ left: index * readStep(list), behavior: isReduced ? 'auto' : 'smooth' });
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
      <span className="cardRowDots" role="group" aria-label={`Choose a card in ${label}`}>
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className="cardRowDot"
            aria-label={`Show ${item.title}`}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => scrollToCard(index)}
          />
        ))}
      </span>
    </div>
  );
};
