import './Routing.css';
import type { CSSProperties } from 'react';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { delay, useInViewOnce } from '../components/Reveal';
import { Shot } from '../components/Shot';
import { S16 } from '../figures';
import { SITE } from '../site';

type Turn = {
  readonly ask: string;
  readonly run: number;
};

type Step = {
  readonly role: string;
  readonly tone: string;
  readonly brand?: BrandId;
  readonly model?: string;
  readonly run: number;
};

const TURNS: readonly Turn[] = [
  { ask: 'read the webhook handler', run: 0.4 },
  { ask: 'plan the dedupe', run: 1.3 },
  { ask: 'write the fix', run: 2.7 },
  { ask: 'fix the tests', run: 4.6 },
  { ask: 'review the diff', run: 7.0 },
  { ask: 'answer the review', run: 9.8 },
];

const STEPS: readonly Step[] = [
  { role: 'Scouts', tone: 'scout', run: 0.13 },
  { role: 'Plan', tone: 'planner', brand: 'anthropic', model: 'Opus 5.5 High', run: 1.41 },
  { role: 'Implement', tone: 'implementer', brand: 'codex', model: 'GPT 5.6 Sol', run: 2.35 },
  { role: 'Test', tone: 'tester', brand: 'anthropic', model: 'Haiku 4.5', run: 2.56 },
  { role: 'Review', tone: 'reviewer', brand: 'codex', model: 'GPT 5.6 Terra', run: 2.85 },
  { role: 'Resolve', tone: 'scout', brand: 'anthropic', model: 'Sonnet 5', run: 3.07 },
];

const TOTAL_ONE_AGENT = 9.8;
const TOTAL_FRESH = 3.07;
const ROW_STAGGER = 140;

const money = (value: number) => `$${value.toFixed(2)}`;

const bar = (run: number, index: number) =>
  ({
    '--w': `${((run / TOTAL_ONE_AGENT) * 100).toFixed(1)}%`,
    ...delay(index * ROW_STAGGER),
  }) as CSSProperties;

export const Routing = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();

  return (
    <section className="block alt" id="routing" aria-labelledby="h2-routing">
      <div className="wrap">
        <div className="blockHead">
          <h2 id="h2-routing">The same task, two very different bills</h2>
          <p className="sub">
            The same six steps, twice. On the left one agent carries the whole chat into each step,
            and the bars climb. On the right a fresh agent takes each step with a short brief, and
            the heavy model runs only where it matters.
          </p>
        </div>
        <div className={inView ? 'bills in' : 'bills'} ref={ref} aria-hidden="true">
          <div className="bill dull">
            <div className="bhead">
              One agent, the whole chat carried into each step
              <small>the same heavy model on every step</small>
            </div>
            {TURNS.map((turn, index) => (
              <div className="brow" key={turn.ask}>
                <span className="bask">{turn.ask}</span>
                <span className="bbar hot" style={bar(turn.run, index)} />
                <span className="bval mono">{money(turn.run)}</span>
              </div>
            ))}
            <div className="bfoot hotx">
              total <b className="mono">{money(TOTAL_ONE_AGENT)}</b>
            </div>
          </div>
          <div className="bill">
            <div className="bhead">
              A fresh agent for each step
              <small>a short brief each time, the heavy model only where it matters</small>
            </div>
            {STEPS.map((step, index) => (
              <div className="brow" key={step.role}>
                <span className="bask">
                  <em className={`role ${step.tone}`}>{step.role}</em>
                  {step.brand != null && <BrandMark brand={step.brand} size={13} />}
                  <small>{step.model}</small>
                </span>
                <span className="bbar cool" style={bar(step.run, index)} />
                <span className="bval mono">{money(step.run)}</span>
              </div>
            ))}
            <div className="bfoot coolx">
              total <b className="mono">{money(TOTAL_FRESH)}</b>
            </div>
          </div>
        </div>
        <p className="caption">
          <span>Example run.</span> Running totals for six steps on the Harborline webhook fix. The
          first three match the costs in the run above.
        </p>
        <div className="sp" />
        <div className="stack">
          <div className="stackText">
            <h3>How much is left, on the top bar</h3>
            <p>
              Goodboy shows what is left of your Claude and Codex plans before you start an agent,
              and what it spent there. When one runs out mid-task and another eligible provider is
              connected, the turn can move there, and the chat says where it went.
            </p>
            <p>
              When Codex offers a free reset, it sits right on the usage page, with a warning if
              spending it now would waste it.
            </p>
            <div className="linkRow">
              <More href={`${SITE.concepts}#provider-routing--balance`}>See how routing works</More>
              <SeeHow anchor="providers-limits-and-cost" />
            </div>
          </div>
          <Shot figure={S16} />
        </div>
      </div>
    </section>
  );
};
