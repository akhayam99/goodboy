import './Routing.css';
import { useEffect, useRef, useState } from 'react';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type Priced = {
  readonly delta: number;
};

type Turn = Priced & {
  readonly key: string;
  readonly ask: string;
  readonly model: string;
  readonly effort?: string;
  readonly carries: string;
  readonly blocks: number;
  readonly run: number;
  readonly worst: boolean;
};

type Step = Priced & {
  readonly key: string;
  readonly role: string;
  readonly tone: string;
  readonly ask: string;
  readonly brand: BrandId;
  readonly model: string;
  readonly effort?: string;
  readonly brief: string;
  readonly run: number;
};

const TURNS: readonly Turn[] = [
  {
    key: 'read',
    ask: 'read the code',
    model: 'Claude Opus',
    effort: 'High',
    carries: 'fresh',
    blocks: 0,
    delta: 0.3,
    run: 0.3,
    worst: false,
  },
  {
    key: 'plan',
    ask: 'plan it',
    model: 'Claude Opus',
    effort: 'High',
    carries: 'carries turn 1',
    blocks: 1,
    delta: 0.55,
    run: 0.85,
    worst: false,
  },
  {
    key: 'endpoint',
    ask: 'write the endpoint',
    model: 'Claude Opus',
    effort: 'High',
    carries: 'carries turns 1 to 2',
    blocks: 2,
    delta: 0.85,
    run: 1.7,
    worst: false,
  },
  {
    key: 'tests',
    ask: 'fix the tests',
    model: 'Claude Opus',
    effort: 'High',
    carries: 'carries turns 1 to 3',
    blocks: 3,
    delta: 1.2,
    run: 2.9,
    worst: false,
  },
  {
    key: 'review',
    ask: 'review the diff',
    model: 'Claude Opus',
    effort: 'High',
    carries: 'carries turns 1 to 4',
    blocks: 4,
    delta: 1.6,
    run: 4.5,
    worst: false,
  },
  {
    key: 'label',
    ask: 'rename one label',
    model: 'Claude Haiku 4.5',
    carries: 'carries turns 1 to 5',
    blocks: 5,
    delta: 2.1,
    run: 6.6,
    worst: true,
  },
];

const STEPS: readonly Step[] = [
  {
    key: 'scout',
    role: 'scout',
    tone: 'scout',
    ask: 'read the code',
    brand: 'gemini',
    model: 'Gemini 3.1 Pro',
    effort: 'High',
    brief: 'brief 2k',
    delta: 0.05,
    run: 0.05,
  },
  {
    key: 'planner',
    role: 'planner',
    tone: 'planner',
    ask: 'plan it',
    brand: 'anthropic',
    model: 'Claude Opus 5',
    effort: 'High',
    brief: 'brief 6k',
    delta: 0.43,
    run: 0.48,
  },
  {
    key: 'implementer',
    role: 'implementer',
    tone: 'implementer',
    ask: 'write the endpoint',
    brand: 'codex',
    model: 'GPT-5.6 Sol',
    brief: 'brief 9k',
    delta: 0.77,
    run: 1.25,
  },
  {
    key: 'tester',
    role: 'tester',
    tone: 'ro-tester',
    ask: 'fix the tests',
    brand: 'cursor',
    model: 'Cursor Opus 5',
    effort: 'High',
    brief: 'brief 5k',
    delta: 0.25,
    run: 1.5,
  },
  {
    key: 'reviewer',
    role: 'reviewer',
    tone: 'reviewer',
    ask: 'review the diff',
    brand: 'codex',
    model: 'GPT-5.5',
    effort: 'High',
    brief: 'brief 7k',
    delta: 0.28,
    run: 1.78,
  },
  {
    key: 'resolver',
    role: 'resolver',
    tone: 'ro-resolver',
    ask: 'rename one label',
    brand: 'anthropic',
    model: 'Claude Haiku 4.5',
    brief: 'brief 3k',
    delta: 0.01,
    run: 1.79,
  },
];

const BUDGET_CAP = 3;

const BASE = 300;
const STEP_MS = 660;
const FILL = 680;
const MAX = 6.6;
const FALLBACK_AT = BASE + STEP_MS + FILL;
const END = BASE + 5 * STEP_MS + FILL;

const rowDelay = (index: number) => BASE + index * STEP_MS;

const blockDelay = (index: number, slot: number) => rowDelay(index) + 110 + slot * 65;

const barWidth = (run: number) => `${Math.max((run / MAX) * 100, 2)}%`;

const money = (value: number) => `$${value.toFixed(2)}`;

const sumAt = (rows: readonly Priced[], elapsed: number) =>
  rows.reduce((acc, row, index) => {
    const t = (elapsed - rowDelay(index)) / FILL;
    if (t <= 0) return acc;
    if (t >= 1) return acc + row.delta;
    return acc + row.delta * t;
  }, 0);

type ChipProps = {
  readonly brand: BrandId;
  readonly model: string;
  readonly effort?: string;
};

const ModelChip = ({ brand, model, effort }: ChipProps) => (
  <span className="ro-chip">
    <BrandMark brand={brand} size={13} />
    <span className="ro-mname">{model}</span>
    {effort != null && <span className="eff">{effort}</span>}
  </span>
);

type CostProps = {
  readonly run: number;
  readonly delta: number;
  readonly hot: boolean;
};

const RoCost = ({ run, delta, hot }: CostProps) => (
  <span className="ro-cost">
    <span className={hot ? 'ro-run ro-hi mono' : 'ro-run mono'}>{money(run)}</span>
    <span className="ro-delta mono">{`+${money(delta)}`}</span>
  </span>
);

type TurnProps = {
  readonly turn: Turn;
  readonly index: number;
};

const RoTurn = ({ turn, index }: TurnProps) => (
  <div
    className={turn.worst ? 'ro-row ro-t ro-worst' : 'ro-row ro-t'}
    style={delay(rowDelay(index))}
  >
    <span className="ro-line">
      <span className="ro-ord mono">{index + 1}</span>
      <span className="ro-ask">{turn.ask}</span>
      <ModelChip brand="anthropic" model={turn.model} effort={turn.effort} />
      <RoCost run={turn.run} delta={turn.delta} hot={turn.worst} />
    </span>
    <span className="ro-meta">
      <span className="ro-stack">
        {Array.from({ length: turn.blocks }, (_, slot) => (
          <span className="ro-blk" key={slot} style={delay(blockDelay(index, slot))} />
        ))}
      </span>
      <span className="ro-carried mono">{turn.carries}</span>
      <span className="ro-bar">
        <span className="ro-fill" style={{ width: barWidth(turn.run) }} />
      </span>
    </span>
    {turn.worst && (
      <span className="ro-note">Five turns of history reread for a one-word change</span>
    )}
  </div>
);

type StepProps = {
  readonly step: Step;
  readonly index: number;
  readonly rerouted: boolean;
};

const RoStep = ({ step, index, rerouted }: StepProps) => (
  <div className="ro-row ro-s" style={delay(rowDelay(index))}>
    <span className="ro-line">
      <span className="ro-ord mono">{index + 1}</span>
      <span className={`kb ${step.tone}`}>{step.role}</span>
      <span className="ro-ask ro-task">{step.ask}</span>
      <ModelChip brand={step.brand} model={step.model} effort={step.effort} />
      <RoCost run={step.run} delta={step.delta} hot={false} />
    </span>
    <span className="ro-meta">
      <span className="ro-carried mono">{step.brief}</span>
      <span className="ro-bar">
        <span className="ro-fill" style={{ width: barWidth(step.run) }} />
      </span>
    </span>
    {step.key === 'planner' && (
      <span className={rerouted ? 'ro-reroute ro-on' : 'ro-reroute'}>
        <BrandMark brand="anthropic" size={12} />
        <span className="ro-arw">→</span>
        <BrandMark brand="codex" size={12} />
        Claude hit its limit, GPT-5.6 Sol finished the step
      </span>
    )}
    {step.key === 'resolver' && (
      <span className="ro-note ro-calm">Same model as the turn on the left, one short brief</span>
    )}
  </div>
);

export const Routing = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [reduced] = useState(prefersReducedMotion);
  const [rerouted, setRerouted] = useState(reduced);
  const oneRef = useRef<HTMLSpanElement>(null);
  const fitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = window.setTimeout(() => setRerouted(true), FALLBACK_AT);
    return () => window.clearTimeout(timer);
  }, [inView, reduced]);

  useEffect(() => {
    const paint = (elapsed: number) => {
      const one = oneRef.current;
      const fit = fitRef.current;
      if (one != null) one.textContent = money(sumAt(TURNS, elapsed));
      if (fit != null) fit.textContent = money(sumAt(STEPS, elapsed));
    };

    if (reduced || !inView) return;

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = now - started;
      if (elapsed >= END) {
        paint(END);
        frame = 0;
        return;
      }
      paint(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [inView, reduced]);

  const stage = reduced ? undefined : inView ? 'play' : 'idle';

  return (
    <section className="block" id="routing" aria-labelledby="h2-routing">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-routing">
            The same task, two very different bills
          </h2>
          <p className="sub rv" style={delay(40)}>
            One chat carries every earlier turn into the next, so the last small change costs the
            most, whatever model does it. A fresh agent per step reads a short brief instead. Both
            columns run the same six tasks on models of comparable weight, so what changes is how
            much context each agent has to read.
          </p>
        </div>

        <div
          className="contrast ro-fig rv"
          data-stage={stage}
          style={delay(80)}
          ref={ref}
          aria-hidden="true"
        >
          <div className="panel dull ro-col ro-heavy">
            <div className="phead">
              One chat, everything carried forward
              <span className="ro-sub2">Claude Code, one chat from start to finish</span>
            </div>
            <div className="pbody">
              <div className="ro-rows">
                {TURNS.map((turn, index) => (
                  <RoTurn key={turn.key} turn={turn} index={index} />
                ))}
              </div>
            </div>
            <div className="pfoot hot">
              total
              <span className="tot mono" ref={oneRef}>
                $6.60
              </span>
            </div>
          </div>
          <span className="vs">vs</span>
          <div className="panel ro-col ro-lean">
            <div className="phead">Goodboy, a fresh agent for each step</div>
            <div className="pbody">
              <div className="ro-rows">
                {STEPS.map((step, index) => (
                  <RoStep key={step.key} step={step} index={index} rerouted={rerouted} />
                ))}
              </div>
            </div>
            <div className="pfoot cool">
              total
              <span className="ro-cap-label mono">cap {money(BUDGET_CAP)}</span>
              <span className="tot mono" ref={fitRef}>
                $1.79
              </span>
            </div>
          </div>
        </div>
        <p className="caption rv" style={delay(110)}>
          <span className="ro-ill">Illustrative figures.</span> Set a budget and Goodboy taps you on
          the shoulder before you cross it, not after.
        </p>
        <a
          className="more rv"
          style={delay(130)}
          href={`${SITE.concepts}#provider-routing--balance`}
        >
          See how routing works <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
