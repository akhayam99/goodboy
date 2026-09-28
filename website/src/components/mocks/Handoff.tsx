import './mocks.css';
import {
  HANDOFF_BRIEF,
  HANDOFF_BRIEF_CHIPS,
  HANDOFF_DELAYS,
  HANDOFF_FROM,
  HANDOFF_LABEL,
  HANDOFF_NOTE,
  HANDOFF_TO,
} from '../../data/harborline';
import { useAlive } from '../../hooks/useAlive';
import { HandoffAgentRow } from './HandoffAgentRow';
import { HandoffContext } from './HandoffContext';
import { TurnIcon } from './TurnIcon';

type Props = {
  readonly className?: string;
};

type WindowParams = {
  readonly step: number;
  readonly from: number;
  readonly until: number;
};

const isBetween = ({ step, from, until }: WindowParams) => step >= from && step < until;

export const Handoff = ({ className }: Props) => {
  const { ref, step } = useAlive({ delays: HANDOFF_DELAYS });
  const isLimited = step >= 1;
  const hasNote = step >= 2;
  const hasTaken = step >= 3;
  const chips = Math.min(HANDOFF_BRIEF_CHIPS.length, Math.max(0, step - 3));
  const tint = {
    goal: isBetween({ step, from: 4, until: 8 }),
    dec: isBetween({ step, from: 6, until: 9 }),
    sum: isBetween({ step, from: 7, until: 10 }),
  };

  return (
    <div
      ref={ref}
      className={['mk-handoff', className].filter(Boolean).join(' ')}
      data-mock="handoff"
      aria-label={HANDOFF_LABEL}
    >
      <div className="mk-win">
        <div className="mk-split">
          <HandoffContext tint={tint} />
          <section className="mk-agents">
            <HandoffAgentRow agent={HANDOFF_FROM} state={isLimited ? 'limit' : 'run'} />
            <div
              className={hasNote ? 'mk-note' : 'mk-note is-hidden'}
              aria-hidden={hasNote ? undefined : true}
            >
              <TurnIcon />
              <span>{HANDOFF_NOTE}</span>
            </div>
            <HandoffAgentRow agent={HANDOFF_TO} state="run" isHidden={!hasTaken} />
            <div
              className={hasTaken ? 'mk-brief' : 'mk-brief is-hidden'}
              aria-hidden={hasTaken ? undefined : true}
            >
              <div className="mk-brief-k">{HANDOFF_BRIEF}</div>
              <div className="mk-bchips">
                {HANDOFF_BRIEF_CHIPS.map((chip, index) => (
                  <span
                    key={chip.label}
                    className={index < chips ? 'mk-bchip' : 'mk-bchip is-hidden'}
                  >
                    {chip.label}
                    {chip.count === undefined ? null : <span className="mk-n">{chip.count}</span>}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
