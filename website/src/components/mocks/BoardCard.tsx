import type { BoardCardData } from '../../data/harborline';
import { formatCents } from './formatCents';

type Props = {
  readonly card: BoardCardData;
  readonly isShut?: boolean;
  readonly isAway?: boolean;
  readonly isPre?: boolean;
};

export const BoardCard = ({ card, isShut = false, isAway = false, isPre = false }: Props) => (
  <div className={isShut ? 'mk-slot is-shut' : 'mk-slot'} aria-hidden={isShut ? true : undefined}>
    <div className="mk-clip">
      <div className="mk-pad">
        <article
          className={['mk-card', isAway ? 'is-away' : null, isPre ? 'is-pre' : null]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="mk-ctitle">{card.title}</div>
          <div className="mk-cmeta">
            <span className="mk-cmeta-l">
              <span className="mk-repo">{card.repo}</span>
              <span className={card.isNeed === true ? 'mk-fact is-need' : 'mk-fact'}>
                {card.fact}
              </span>
            </span>
            <span className="mk-cost mk-num">{formatCents({ cents: card.cents })}</span>
          </div>
        </article>
      </div>
    </div>
  </div>
);
