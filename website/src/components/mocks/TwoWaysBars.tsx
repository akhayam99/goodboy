import './TwoWaysBars.css';
import type { CSSProperties } from 'react';
import { BrandMark, type ProviderId } from '../BrandIcons';
import { usePlayOnce } from './usePlayOnce';

type Turn = {
  readonly ask: string;
  readonly short: string;
  readonly run: number;
};

type Step = {
  readonly role: string;
  readonly tone: string;
  readonly brand?: ProviderId;
  readonly model?: string;
  readonly run: number;
};

type BarStyle = CSSProperties & {
  readonly '--w': string;
  readonly '--d': string;
};

const TURNS: readonly Turn[] = [
  { ask: 'Read the webhook handler', short: 'Read', run: 0.4 },
  { ask: 'Plan the dedupe', short: 'Plan', run: 1.3 },
  { ask: 'Write the fix', short: 'Write', run: 2.7 },
  { ask: 'Fix the tests', short: 'Tests', run: 4.6 },
  { ask: 'Review the diff', short: 'Review', run: 7.0 },
  { ask: 'Answer the review', short: 'Answer', run: 9.8 },
];

const STEPS: readonly Step[] = [
  { role: 'Scouts', tone: 'scout', run: 0.13 },
  { role: 'Plan', tone: 'planner', brand: 'anthropic', model: 'Opus 5.5 High', run: 1.41 },
  { role: 'Implement', tone: 'implementer', brand: 'codex', model: 'GPT 5.6 Sol', run: 2.35 },
  { role: 'Test', tone: 'tester', brand: 'anthropic', model: 'Haiku 4.5', run: 2.56 },
  { role: 'Review', tone: 'reviewer', brand: 'codex', model: 'GPT 5.6 Terra', run: 2.85 },
  { role: 'Resolve', tone: 'resolver', brand: 'anthropic', model: 'Sonnet 5', run: 3.07 },
];

const TOTAL_ONE_AGENT = 9.8;
const TOTAL_FRESH = 3.07;
const PLAY_MS = 1600;

const money = (value: number) => `$${value.toFixed(2)}`;

const bar = (run: number, index: number): BarStyle => ({
  '--w': `${((run / TOTAL_ONE_AGENT) * 100).toFixed(1)}%`,
  '--d': `${200 + index * 70}ms`,
});

export const TwoWaysBars = () => {
  const { ref, phase } = usePlayOnce<HTMLDivElement>({ duration: PLAY_MS });

  return (
    <div
      ref={ref}
      className="twoWays"
      data-play={phase}
      role="group"
      aria-label="The same six steps run two ways: one long conversation costs $9.80, a fresh agent per step costs $3.07"
    >
      <div className="twPair">
        <section className="twBill">
          <h3 className="twTitle">One long conversation</h3>
          <p className="twSub">One heavy model rereads the whole history at every step.</p>
          <div className="twRows">
            {TURNS.map((turn, index) => (
              <div className="twRow" key={turn.ask}>
                <span className="twAsk">
                  <span className="twLong">{turn.ask}</span>
                  <span className="twShort">{turn.short}</span>
                </span>
                <span className="twBar dull" style={bar(turn.run, index)} aria-hidden="true" />
                <span className="twValue">{money(turn.run)}</span>
              </div>
            ))}
          </div>
          <p className="twTotal">
            Total <b>{money(TOTAL_ONE_AGENT)}</b>
          </p>
        </section>
        <section className="twBill">
          <h3 className="twTitle">With Goodboy</h3>
          <p className="twSub">A fresh agent per step, on the model that fits it.</p>
          <div className="twRows">
            {STEPS.map((step, index) => (
              <div className="twRow" key={step.role}>
                <span className="twAsk">
                  <span className="twRole">{step.role}</span>
                  {step.brand === undefined ? null : (
                    <span className="twDetail">
                      <BrandMark brand={step.brand} size={13} />
                    </span>
                  )}
                  {step.model === undefined ? null : (
                    <small className="twDetail">{step.model}</small>
                  )}
                </span>
                <span
                  className="twBar fresh"
                  data-tone={step.tone}
                  style={bar(step.run, index)}
                  aria-hidden="true"
                />
                <span className="twValue">{money(step.run)}</span>
              </div>
            ))}
          </div>
          <p className="twTotal fresh">
            Total <b>{money(TOTAL_FRESH)}</b>
          </p>
        </section>
      </div>
    </div>
  );
};
