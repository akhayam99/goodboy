import './mocks.css';
import { Fragment } from 'react';
import { HARBORLINE } from '../../data/harborline';
import { useAlive } from '../../hooks/useAlive';
import { ActivityQuestion } from './ActivityQuestion';
import { ActivityRow } from './ActivityRow';
import { StateChip } from './StateChip';
import { WindowHead } from './WindowHead';

const { ACTIVITY_DELAYS, ACTIVITY_HEAD, ACTIVITY_LABEL, ACTIVITY_ROWS, TASK_REPO, TASK_TITLE } =
  HARBORLINE;

type Props = {
  readonly className?: string;
};

export const Activity = ({ className }: Props) => {
  const { ref, step } = useAlive({ delays: ACTIVITY_DELAYS });
  const isAsked = step >= 1;

  return (
    <div
      ref={ref}
      className={['mk-activity', className].filter(Boolean).join(' ')}
      data-mock="activity"
      role="img"
      aria-label={ACTIVITY_LABEL}
    >
      <div className="mk-win">
        <WindowHead
          title={TASK_TITLE}
          sub={TASK_REPO}
          side={
            <>
              <StateChip kind="need" text={ACTIVITY_HEAD.need} isOff={!isAsked} />
              <StateChip kind="run" text={ACTIVITY_HEAD.run} />
            </>
          }
        />
        <div className="mk-arows">
          {ACTIVITY_ROWS.map((row) => {
            const isAsk = row.isAsk === true;
            return (
              <Fragment key={row.role}>
                <ActivityRow
                  row={row}
                  state={isAsk && isAsked ? 'need' : row.state}
                  isAsking={isAsk && isAsked}
                />
                {isAsk ? <ActivityQuestion isOpen={isAsked} /> : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
