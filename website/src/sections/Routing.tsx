import './Routing.css';
import type { CSSProperties } from 'react';
import { BrandMark, type ProviderId } from '../components/BrandIcons';
import { Chapter } from '../components/Chapter';
import { Frame } from '../components/Frame';
import { IMPACT } from '../figures';
import { StorageAndChat } from './StorageAndChat';

type Turn = {
  readonly ask: string;
  readonly run: number;
};

type Step = {
  readonly role: string;
  readonly brand?: ProviderId;
  readonly model?: string;
  readonly run: number;
};

type BarStyle = CSSProperties & {
  readonly '--w': string;
};

const TURNS: readonly Turn[] = [
  { ask: 'Read the webhook handler', run: 0.4 },
  { ask: 'Plan the dedupe', run: 1.3 },
  { ask: 'Write the fix', run: 2.7 },
  { ask: 'Fix the tests', run: 4.6 },
  { ask: 'Review the diff', run: 7.0 },
  { ask: 'Answer the review', run: 9.8 },
];

const STEPS: readonly Step[] = [
  { role: 'Scouts', run: 0.13 },
  { role: 'Plan', brand: 'anthropic', model: 'Opus 5.5 High', run: 1.41 },
  { role: 'Implement', brand: 'codex', model: 'GPT 5.6 Sol', run: 2.35 },
  { role: 'Test', brand: 'anthropic', model: 'Haiku 4.5', run: 2.56 },
  { role: 'Review', brand: 'codex', model: 'GPT 5.6 Terra', run: 2.85 },
  { role: 'Resolve', brand: 'anthropic', model: 'Sonnet 5', run: 3.07 },
];

const TOTAL_ONE_AGENT = 9.8;
const TOTAL_FRESH = 3.07;

const money = (value: number) => `$${value.toFixed(2)}`;

const bar = (run: number): BarStyle => ({
  '--w': `${((run / TOTAL_ONE_AGENT) * 100).toFixed(1)}%`,
});

export const Routing = () => (
  <Chapter
    id="routing"
    head={{
      eyebrow: 'Providers, limits and cost',
      heading: 'Know what a task costs before the bill',
      lead: 'The top bar shows what is left of each plan, and every step records what it spent.',
    }}
  >
    <Frame figure={IMPACT} />
    <div className="bills">
      <div className="billsHead">
        <h3 className="sectionTitle">The same task, two bills</h3>
        <p className="body">
          The same six steps, twice. One agent carrying the whole chat pays for it on every step. A
          fresh agent per step reads a short brief, and the heavy model runs only where it matters.
        </p>
      </div>
      <div className="billPair" aria-hidden="true">
        <div className="bill">
          <p className="billTitle">
            One agent, the whole chat each time
            <small>The same heavy model on every step</small>
          </p>
          {TURNS.map((turn) => (
            <div className="billRow" key={turn.ask}>
              <span className="billAsk">{turn.ask}</span>
              <span className="billBar dull" style={bar(turn.run)} />
              <span className="billValue">{money(turn.run)}</span>
            </div>
          ))}
          <p className="billTotal">
            Total <b>{money(TOTAL_ONE_AGENT)}</b>
          </p>
        </div>
        <div className="bill">
          <p className="billTitle">
            A fresh agent for each step
            <small>A short brief each time, the heavy model only where it matters</small>
          </p>
          {STEPS.map((step) => (
            <div className="billRow" key={step.role}>
              <span className="billAsk">
                <span className="billRole">{step.role}</span>
                {step.brand === undefined ? null : <BrandMark brand={step.brand} size={13} />}
                {step.model === undefined ? null : <small>{step.model}</small>}
              </span>
              <span className="billBar fresh" style={bar(step.run)} />
              <span className="billValue">{money(step.run)}</span>
            </div>
          ))}
          <p className="billTotal fresh">
            Total <b>{money(TOTAL_FRESH)}</b>
          </p>
        </div>
      </div>
      <p className="billNote">
        Example run: running totals for six steps on the Harborline webhook fix. The first three
        match the workflow run shown earlier.
      </p>
    </div>
    <StorageAndChat />
  </Chapter>
);
