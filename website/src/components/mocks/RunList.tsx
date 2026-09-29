import './mocks.css';
import { HARBORLINE, type ChipKind } from '../../data/harborline';
import { useAlive } from '../../hooks/useAlive';
import { formatCents } from './formatCents';
import { RunRow } from './RunRow';
import { RunTotal } from './RunTotal';
import { WindowHead } from './WindowHead';

const {
  RUN_DELAYS,
  RUN_HEAVY_CENTS,
  RUN_HEAVY_LABEL,
  RUN_LABEL,
  TASK_REPO,
  RUN_ROWS,
  RUN_SIDE,
  RUN_START_DONE,
  TASK_TITLE,
  RUN_TOTAL_LABEL,
} = HARBORLINE;

type Props = {
  readonly className?: string;
};

type StateParams = {
  readonly index: number;
  readonly done: number;
};

const stateOf = ({ index, done }: StateParams): ChipKind => {
  if (index < done) {
    return 'done';
  }
  return index === done ? 'run' : 'queued';
};

export const RunList = ({ className }: Props) => {
  const { ref, step } = useAlive({ delays: RUN_DELAYS });
  const done = RUN_START_DONE + step;
  const total = RUN_ROWS.slice(0, done).reduce((sum, row) => sum + row.cents, 0);
  const share = `${((total / RUN_HEAVY_CENTS) * 100).toFixed(2)}%`;

  return (
    <div
      ref={ref}
      className={['mk-run', className].filter(Boolean).join(' ')}
      data-mock="run"
      role="img"
      aria-label={RUN_LABEL}
    >
      <div className="mk-win">
        <WindowHead title={TASK_TITLE} sub={TASK_REPO} side={<span>{RUN_SIDE}</span>} />
        <div className="mk-rows">
          {RUN_ROWS.map((row, index) => (
            <RunRow key={row.role} row={row} state={stateOf({ index, done })} />
          ))}
        </div>
        <div className="mk-foot">
          <div className="mk-foot-top">
            <span className="mk-foot-l">
              <span className="mk-foot-k">{RUN_TOTAL_LABEL}</span>
              <RunTotal cents={total} />
            </span>
            <span className="mk-foot-r">
              {RUN_HEAVY_LABEL}{' '}
              <span className="mk-num">{formatCents({ cents: RUN_HEAVY_CENTS })}</span>
            </span>
          </div>
          <div className="mk-bars" aria-hidden="true">
            <div className="mk-bar">
              <i className="mk-bar-run" style={{ width: share }} />
            </div>
            <div className="mk-bar">
              <i className="is-ref" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
