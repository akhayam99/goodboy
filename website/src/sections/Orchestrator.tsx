import { useEffect, useState } from 'react';
import './Orchestrator.css';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useToggleInView } from '../components/Reveal';

type Agent = {
  readonly name: string;
  readonly brand: BrandId;
  readonly model: string;
  readonly effort?: string;
  readonly ew: number;
  readonly y: number;
  readonly ty: number;
};

const AGENTS: readonly Agent[] = [
  {
    name: 'scout',
    brand: 'anthropic',
    model: 'Claude Haiku 4.5',
    ew: 0,
    y: 62,
    ty: 278,
  },
  {
    name: 'planner',
    brand: 'anthropic',
    model: 'Claude Opus',
    effort: 'High',
    ew: 44,
    y: 152,
    ty: 350,
  },
  {
    name: 'implementer',
    brand: 'codex',
    model: 'GPT-5.6 Sol',
    ew: 0,
    y: 242,
    ty: 422,
  },
  {
    name: 'reviewer',
    brand: 'cursor',
    model: 'Composer',
    ew: 0,
    y: 332,
    ty: 494,
  },
];

const WAYS: readonly (readonly [string, string])[] = [
  ['preset: scout, planner,', 'implementer, reviewer'],
  ['built from the goal', 'by the orchestrator'],
];

const DUR: readonly number[] = [
  330, 440, 380, 440, 100, 380, 440, 100, 380, 440, 100, 380, 440, 100, 360,
];

const LAST = DUR.length;

const OUT_STEP = 14;

const FIG_LABEL =
  'A workflow spawns one agent per step. You send a goal, the workflow comes from a preset or from a plan the orchestrator builds, then an agent is created for each step: scout on Claude Haiku 4.5, planner on Claude Opus at high effort, implementer on Codex GPT-5.6 Sol, reviewer on Cursor Composer. Each one reports back to the workflow and is let go, and the run ends with draft pull request 1045 waiting for you to merge.';

type Scene = {
  readonly phase: (i: number) => string;
  readonly lead: string;
  readonly wire: string;
  readonly out: string;
  readonly bubbleOn: boolean;
  readonly readOn: boolean;
  readonly way: readonly [string, string];
  readonly wayKey: number;
  readonly still: boolean;
};

const outSpoke = (y: number) => `M390,198 C 480,198 600,${y} 740,${y}`;

const PrGlyph = ({ size }: { readonly size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <path d="M6 9v12" />
  </svg>
);

const Wide = ({ s }: { readonly s: Scene }) => (
  <svg className="or-wide" viewBox="0 0 1120 520" role="img" aria-label={FIG_LABEL}>
    <path className={`or-spoke or-lead ${s.lead}`} d="M202,198 L246,198" />

    {AGENTS.map((a, i) => (
      <path
        className={`or-spoke or-n${i + 1} ${s.phase(i)}`}
        key={`spoke-${a.name}`}
        d={outSpoke(a.y)}
      />
    ))}

    <path
      className={`or-spoke or-outspoke ${s.wire}`}
      d="M348,275 C 420,400 540,447 680,447 L 740,447"
    />

    <g>
      <text className="or-lab" x={10} y={142}>
        you
      </text>
      <circle className="or-halo" cx={320} cy={198} r={78} />
      <circle className="or-hub" cx={320} cy={198} r={70} />
      <text className="or-hubname" x={320} y={190}>
        workflow
      </text>
      <line className="or-hr" x1={286} y1={199} x2={354} y2={199} />
    </g>

    <g className={s.bubbleOn ? 'or-bubble or-on' : 'or-bubble'}>
      <path
        className="or-card"
        d="M20,154 H170 A14,14 0 0 1 184,168 V186 L197,198 L184,210 V228 A14,14 0 0 1 170,242 H20 A14,14 0 0 1 6,228 V168 A14,14 0 0 1 20,154 Z"
      />
      <text className="or-msg" x={22} y={184}>
        Ship LIN-241,
      </text>
      <text className="or-msg" x={22} y={202}>
        bulk archive for
      </text>
      <text className="or-msg" x={22} y={220}>
        notifications
      </text>
    </g>

    {s.readOn ? (
      <g className="or-read" key={s.wayKey}>
        <text className="or-readout" x={320} y={214}>
          {s.way[0]}
        </text>
        <text className="or-readout" x={320} y={228}>
          {s.way[1]}
        </text>
      </g>
    ) : null}

    {AGENTS.map((a, i) => (
      <g className={`or-node or-n${i + 1} ${s.phase(i)}`} key={`node-${a.name}`}>
        <rect className="or-nrect" x={740} y={a.y - 35} width={230} height={70} rx={14} />
        <rect className="or-nbar" x={754} y={a.y - 18} width={4} height={36} rx={2} />
        <text className="or-role" x={770} y={a.y - 8}>
          {a.name}
        </text>
        <g transform={`translate(770,${a.y + 2})`}>
          <BrandMark brand={a.brand} size={13} />
        </g>
        <text className="or-model" x={789} y={a.y + 13}>
          {a.model}
        </text>
        {a.effort ? (
          <>
            <rect className="or-effbg" x={956 - a.ew} y={a.y} width={a.ew} height={18} rx={9} />
            <text className="or-eff" x={956 - a.ew / 2} y={a.y + 13}>
              {a.effort}
            </text>
          </>
        ) : null}
      </g>
    ))}

    <g className={`or-outcome ${s.out}`}>
      <rect className="or-orect" x={740} y={400} width={230} height={94} rx={16} />
      <g className="or-prglyph" transform="translate(764,434)">
        <PrGlyph size={26} />
      </g>
      <text className="or-out-t" x={808} y={442}>
        Draft PR #1045
      </text>
      <text className="or-out-s" x={808} y={468}>
        merging waits for you
      </text>
    </g>

    {s.still ? (
      <g className="or-nums">
        {AGENTS.map((a, i) => (
          <g className="or-num" key={`num-${a.name}`}>
            <circle cx={716} cy={a.y} r={9} />
            <text x={716} y={a.y + 3.5}>
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    ) : null}
  </svg>
);

const Tall = ({ s }: { readonly s: Scene }) => (
  <svg className="or-tall" viewBox="0 0 360 612" role="img" aria-label={FIG_LABEL}>
    <path className={`or-spoke or-rail or-lead ${s.lead}`} d="M180,82 L180,96" />

    {AGENTS.map((a, i) => (
      <path
        className={`or-spoke or-rail or-n${i + 1} ${s.phase(i)}`}
        key={`trail-${a.name}`}
        d={`M180,${a.ty - 46} L180,${a.ty - 26}`}
      />
    ))}

    <path className={`or-spoke or-rail or-outspoke ${s.wire}`} d="M180,520 L180,540" />

    <g>
      <text className="or-lab" x={10} y={12}>
        you
      </text>
      <circle className="or-halo" cx={180} cy={164} r={68} />
      <circle className="or-hub" cx={180} cy={164} r={62} />
      <text className="or-hubname" x={180} y={159}>
        workflow
      </text>
      <line className="or-hr" x1={148} y1={167} x2={212} y2={167} />
    </g>

    <g className={s.bubbleOn ? 'or-bubble or-on' : 'or-bubble'}>
      <path
        className="or-card"
        d="M20,18 H340 A12,12 0 0 1 352,30 V60 A12,12 0 0 1 340,72 H190 L180,82 L170,72 H20 A12,12 0 0 1 8,60 V30 A12,12 0 0 1 20,18 Z"
      />
      <text className="or-msg" x={24} y={41}>
        Ship LIN-241, bulk archive
      </text>
      <text className="or-msg" x={24} y={59}>
        for notifications
      </text>
    </g>

    {s.readOn ? (
      <g className="or-read" key={s.wayKey}>
        <text className="or-readout" x={180} y={177}>
          {s.way[0]}
        </text>
        <text className="or-readout" x={180} y={189}>
          {s.way[1]}
        </text>
      </g>
    ) : null}

    {AGENTS.map((a, i) => (
      <g className={`or-node or-n${i + 1} ${s.phase(i)}`} key={`tnode-${a.name}`}>
        <rect className="or-nrect" x={8} y={a.ty - 26} width={344} height={52} rx={12} />
        <rect className="or-nbar" x={24} y={a.ty - 14} width={4} height={28} rx={2} />
        <text className="or-role" x={40} y={a.ty - 5}>
          {a.name}
        </text>
        <g transform={`translate(40,${a.ty + 3})`}>
          <BrandMark brand={a.brand} size={12} />
        </g>
        <text className="or-model" x={58} y={a.ty + 13}>
          {a.model}
        </text>
        {a.effort ? (
          <>
            <rect className="or-effbg" x={336 - a.ew} y={a.ty - 9} width={a.ew} height={18} rx={9} />
            <text className="or-eff" x={336 - a.ew / 2} y={a.ty + 4}>
              {a.effort}
            </text>
          </>
        ) : null}
      </g>
    ))}

    <g className={`or-outcome ${s.out}`}>
      <rect className="or-orect" x={8} y={540} width={344} height={64} rx={14} />
      <g className="or-prglyph" transform="translate(32,561)">
        <PrGlyph size={22} />
      </g>
      <text className="or-out-t" x={68} y={567}>
        Draft PR #1045
      </text>
      <text className="or-out-s" x={68} y={587}>
        merging waits for you
      </text>
    </g>
  </svg>
);

export const Orchestrator = () => {
  const { ref, inView } = useToggleInView<HTMLDivElement>();
  const [still] = useState(prefersReducedMotion);
  const [step, setStep] = useState(0);
  const [way, setWay] = useState(0);

  useEffect(() => {
    if (still) return;
    if (!inView) {
      if (step > 0) setWay((w) => (w + 1) % WAYS.length);
      setStep(0);
      return;
    }
    if (step >= LAST) return;
    const id = window.setTimeout(() => setStep(step + 1), DUR[step]);
    return () => window.clearTimeout(id);
  }, [inView, still, step]);

  const scene: Scene = {
    phase: (i) => {
      if (still) return 'or-live';
      const base = 2 + i * 3;
      return step < base ? 'or-off' : 'or-live';
    },
    lead: still || step >= 1 ? 'or-live' : 'or-off',
    wire: still || step >= OUT_STEP ? 'or-live' : 'or-off',
    out: still || step > OUT_STEP ? 'or-live' : 'or-off',
    bubbleOn: still || inView,
    readOn: still || step >= 1,
    way: WAYS[still ? 0 : way],
    wayKey: still ? 0 : way,
    still,
  };

  return (
    <section className="block alt" id="how" aria-labelledby="h2-how">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-how">
            How it works
          </h2>
          <p className="sub rv" style={delay(80)}>
            Pick a workflow, or describe the goal and let the orchestrator build one. Every step
            gets its own agent, on the model that fits the effort.
          </p>
        </div>

        <div className="or-fig rv" style={delay(160)} ref={ref}>
          <div className="or-stage">
            <Wide s={scene} />
            <Tall s={scene} />
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          Agents are created for the step and let go after it.
        </p>
      </div>
    </section>
  );
};
