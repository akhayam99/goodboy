import { useEffect, useState } from 'react';
import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { usePrefersReducedMotion } from './motion';

type Row = {
  role: string;
  action: string;
  model: string;
  brand: Brand;
  y: number;
};

const ROWS: ReadonlyArray<Row> = [
  {
    role: 'scout',
    action: 'Maps the auth surface',
    model: 'Composer 2.5',
    brand: 'cursor',
    y: 20,
  },
  { role: 'plan', action: 'Drafts the reset flow', model: 'Opus 5', brand: 'anthropic', y: 76 },
  { role: 'implement', action: 'Token + endpoint', model: 'GPT-5.6', brand: 'codex', y: 132 },
  { role: 'test', action: 'Runs the suite', model: 'MiniMax M2.5', brand: 'opencode', y: 188 },
  { role: 'review', action: 'Opens the PR', model: 'Gemini 3.1 Pro', brand: 'gemini', y: 244 },
  { role: 'resolve', action: 'Answers a comment', model: 'Kimi K2', brand: 'openrouter', y: 300 },
];

type Summary = { state: string; next: string };

const SUMMARY: ReadonlyArray<Summary | null> = [
  null,
  { state: 'Auth surface mapped', next: 'Draft reset flow' },
  { state: 'Reset flow drafted', next: 'Build the token' },
  { state: 'Endpoint in place', next: 'Run the suite' },
  { state: 'Suite green', next: 'Open the PR' },
  { state: 'PR #128 open', next: 'Answer comments' },
  { state: 'Fix committed', next: 'Push the batch' },
];

type Beat = { step: number; phase: 'decide' | 'run' | 'write' | 'done' };

const PREFILLED = 3;

const BEATS: ReadonlyArray<Beat> = (() => {
  const out: Beat[] = [];
  for (let s = PREFILLED; s < ROWS.length; s += 1) {
    out.push({ step: s, phase: 'decide' });
    out.push({ step: s, phase: 'run' });
    out.push({ step: s, phase: 'write' });
  }
  out.push({ step: -1, phase: 'done' });
  return out;
})();

const DUR: Record<Beat['phase'], number> = { decide: 750, run: 950, write: 680, done: 1400 };

const Skeleton = ({ y, w }: { y: number; w: number }) => (
  <rect
    x="230"
    y={y}
    width={w}
    height="5"
    rx="2.5"
    fill="var(--color-muted-foreground)"
    fillOpacity="0.18"
  />
);

const DecidePill = ({ y }: { y: number }) => (
  <g className="tg-fade">
    <rect
      x="14"
      y={y}
      width="184"
      height="48"
      rx="11"
      fill="var(--color-elevated)"
      stroke="var(--color-border-soft)"
      strokeWidth="1"
    />
    <circle
      cx="32"
      cy={y + 24}
      r="3"
      fill="var(--color-primary)"
      style={{ animation: 'soft-pulse 1.4s ease-in-out infinite' }}
    />
    <text x="46" y={y + 27} className="fill-muted-foreground text-[9.5px]">
      picking the next step
    </text>
  </g>
);

export const ThreadGraphSnapshot = () => {
  const reduced = usePrefersReducedMotion();
  const [beatIndex, setBeatIndex] = useState(0);
  const { ref, inView } = useToggleInView<SVGSVGElement>();

  useEffect(() => {
    if (reduced || !inView) {
      return undefined;
    }
    const id = window.setTimeout(
      () => setBeatIndex((prev) => (prev + 1) % BEATS.length),
      DUR[BEATS[beatIndex].phase],
    );
    return () => window.clearTimeout(id);
  }, [beatIndex, reduced, inView]);

  const beat = reduced ? null : BEATS[beatIndex];
  const writing = beat?.phase === 'write';
  const ctxLit = beat?.phase === 'write' || beat?.phase === 'done';
  const progress =
    beat == null
      ? ROWS.length
      : beat.phase === 'done'
        ? ROWS.length
        : beat.phase === 'write'
          ? beat.step + 1
          : beat.step;

  const stateOf = (i: number): 'idle' | 'running' | 'done' | 'pending' | 'deciding' => {
    if (beat == null) {
      return 'idle';
    }
    if (beat.phase === 'done' || i < beat.step) {
      return 'done';
    }
    if (i === beat.step) {
      if (beat.phase === 'decide') {
        return 'deciding';
      }
      return beat.phase === 'run' ? 'running' : 'done';
    }
    return 'pending';
  };

  const showDecisions = progress >= 2;
  const question = progress < 2 ? 'none' : progress < 4 ? 'open' : 'answered';
  const summary = SUMMARY[progress];

  return (
    <svg
      ref={ref}
      width="100%"
      viewBox="0 0 400 376"
      role="img"
      aria-label="An orchestrated run on a password reset: each next step picked at runtime, feeding one shared context"
      className="block w-full p-3"
    >
      <defs>
        <marker
          id="tg-arrow"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5.5"
          markerHeight="5.5"
          orient="auto-start-reverse"
        >
          <path
            d="M2 1.5L7.5 5L2 8.5"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      {[68, 124, 180, 236, 292].map((y, i) => (
        <path
          key={`seq-${y}`}
          d={`M106 ${y} L106 ${y + 8}`}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeOpacity="0.32"
          strokeWidth="1.1"
          markerEnd="url(#tg-arrow)"
          opacity={stateOf(i + 1) === 'pending' ? 0 : 1}
          style={{ transition: 'opacity 0.35s' }}
        />
      ))}

      {ROWS.map((row, i) => (
        <path
          key={`tap-${row.role}`}
          d={`M198 ${row.y + 24} L214 ${row.y + 24}`}
          fill="none"
          stroke="var(--color-primary)"
          strokeOpacity="0.38"
          strokeWidth="1.3"
          opacity={stateOf(i) === 'pending' ? 0 : 1}
          style={{ transition: 'opacity 0.3s' }}
        />
      ))}

      {writing && beat != null ? (
        <circle
          key={`packet-${beatIndex}`}
          className="tg-send"
          cx="198"
          cy={ROWS[beat.step].y + 24}
          r="3.2"
          fill="var(--color-primary)"
        />
      ) : null}

      {ROWS.map((row, i) => {
        const state = stateOf(i);
        if (state === 'deciding') {
          return <DecidePill key={`pill-${row.role}`} y={row.y} />;
        }
        const pending = state === 'pending';
        const running = state === 'running';
        return (
          <g
            key={row.role}
            className={i > 0 && !reduced && !pending ? 'tg-fade' : undefined}
            style={pending ? { opacity: 0, transition: 'opacity 0.35s' } : undefined}
          >
            <rect
              x="14"
              y={row.y}
              width="184"
              height="48"
              rx="11"
              fill="var(--color-elevated)"
              stroke={running ? 'var(--color-primary)' : 'var(--color-border-soft)'}
              strokeOpacity={running ? 0.85 : 1}
              strokeWidth={running ? 1.4 : 1}
              style={{ transition: 'stroke 0.3s, stroke-opacity 0.3s' }}
            />
            {running ? (
              <rect
                x="14"
                y={row.y}
                width="184"
                height="48"
                rx="11"
                fill="var(--color-primary)"
                fillOpacity="0.08"
              />
            ) : null}
            {running ? (
              <rect
                x="16"
                y={row.y + 13}
                width="3"
                height="22"
                rx="1.5"
                fill="var(--color-primary)"
                style={{ animation: 'soft-pulse 1.4s ease-in-out infinite' }}
              />
            ) : null}
            <rect
              x="24"
              y={row.y + 13}
              width="22"
              height="22"
              rx="6"
              fill={`var(--color-provider-${row.brand})`}
              fillOpacity="0.14"
            />
            <svg x="27" y={row.y + 16} width="16" height="16" viewBox="0 0 24 24">
              <path d={BRAND_PATH[row.brand]} fill={`var(--color-provider-${row.brand})`} />
            </svg>
            <text x="54" y={row.y + 22} className="fill-foreground text-[11px] font-medium">
              {row.role}
            </text>
            <text x="54" y={row.y + 37} className="fill-muted-foreground text-[8.5px]">
              {row.action}
            </text>
            <text
              x="190"
              y={row.y + 22}
              textAnchor="end"
              className="fill-muted-foreground text-[8.5px]"
            >
              {row.model}
            </text>
          </g>
        );
      })}

      <rect
        x="216"
        y="20"
        width="170"
        height="328"
        rx="16"
        fill="var(--color-primary)"
        fillOpacity={ctxLit ? 0.1 : 0.06}
        stroke="var(--color-primary)"
        strokeOpacity={ctxLit ? 0.85 : 0.38}
        strokeWidth={ctxLit ? 1.4 : 1}
        style={{ transition: 'fill-opacity 0.4s, stroke-opacity 0.4s, stroke-width 0.4s' }}
      />
      <rect x="230" y="34" width="16" height="16" rx="5" fill="var(--color-primary)" />
      <text x="252" y="46" className="fill-foreground text-[11px] font-semibold">
        Context
      </text>
      <line
        x1="230"
        y1="60"
        x2="372"
        y2="60"
        stroke="var(--color-border-soft)"
        strokeOpacity="0.5"
      />

      <text
        x="230"
        y="82"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Goal
      </text>
      <text x="230" y="97" className="fill-foreground text-[10.5px]">
        Reset a user&apos;s password
      </text>

      <text
        x="230"
        y="126"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Decisions
      </text>
      {showDecisions ? (
        <text key="dec" x="230" y="141" className="fill-foreground text-[10.5px] tg-fade">
          Stateless JWT, 30-min TTL
        </text>
      ) : (
        <Skeleton y={136} w={118} />
      )}

      <text
        x="230"
        y="170"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Session summary
      </text>
      {summary == null ? (
        <>
          <Skeleton y={180} w={142} />
          <Skeleton y={192} w={104} />
        </>
      ) : (
        <g key={summary.state} className="tg-fade">
          <text x="230" y="186" className="text-[10px]">
            <tspan className="fill-muted-foreground">State: </tspan>
            <tspan className="fill-foreground">{summary.state}</tspan>
          </text>
          <text x="230" y="200" className="text-[10px]">
            <tspan className="fill-muted-foreground">Next: </tspan>
            <tspan className="fill-foreground">{summary.next}</tspan>
          </text>
        </g>
      )}

      <rect
        x="224"
        y="220"
        width="154"
        height="62"
        rx="10"
        fill="var(--color-warning)"
        fillOpacity={question === 'open' ? 0.07 : 0.03}
        stroke="var(--color-warning)"
        strokeOpacity={question === 'open' ? 0.4 : 0.18}
        strokeWidth="1"
        style={{ transition: 'fill-opacity 0.4s, stroke-opacity 0.4s' }}
      />
      <text
        x="236"
        y="240"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Questions
      </text>
      {question === 'none' ? <Skeleton y={252} w={92} /> : null}
      {question === 'open' ? (
        <g key="q-open" className="tg-fade">
          <circle
            cx="239"
            cy="256"
            r="3"
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth="1.4"
          />
          <text x="250" y="259" className="fill-foreground text-[10px]">
            Rate-limit per IP?
          </text>
          <text x="236" y="273" className="fill-muted-foreground text-[8.5px]">
            waiting on you
          </text>
        </g>
      ) : null}
      {question === 'answered' ? (
        <g key="q-ans" className="tg-fade">
          <path
            d="M236 256 l3 3 L244 252"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="250"
            y="259"
            className="fill-muted-foreground text-[10px]"
            style={{ textDecoration: 'line-through' }}
          >
            Rate-limit per IP?
          </text>
          <text x="236" y="273" className="fill-success text-[8.5px]">
            answered, per IP
          </text>
        </g>
      ) : null}

      <text x="230" y="316" className="fill-muted-foreground text-[8.5px]">
        The next agent starts here.
      </text>
    </svg>
  );
};
