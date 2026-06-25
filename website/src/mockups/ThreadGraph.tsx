import { useEffect, useState } from 'react';
import { BRAND_PATH, type Brand } from '../components/BrandIcons';

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
    model: 'Composer 2 Fast',
    brand: 'cursor',
    y: 20,
  },
  { role: 'plan', action: 'Drafts the reset flow', model: 'Opus 4.8', brand: 'anthropic', y: 82 },
  { role: 'implement', action: 'Token + endpoint', model: 'GPT-5.3 Codex', brand: 'codex', y: 144 },
  { role: 'test', action: 'Runs the suite', model: 'Haiku 4.5', brand: 'anthropic', y: 206 },
  { role: 'review', action: 'Opens the PR', model: 'Sonnet 4.6', brand: 'anthropic', y: 268 },
];

const LAST_OUTPUT = [
  '',
  'Mapped the auth surface',
  'Drafted the reset flow',
  'Built token + endpoint',
  'Suite green',
  'Opened PR #128',
];

type Beat = { step: number; phase: 'run' | 'write' | 'done' };

const BEATS: ReadonlyArray<Beat> = (() => {
  const out: Beat[] = [];
  for (let s = 0; s < ROWS.length; s += 1) {
    out.push({ step: s, phase: 'run' });
    out.push({ step: s, phase: 'write' });
  }
  out.push({ step: -1, phase: 'done' });
  return out;
})();

const DUR: Record<Beat['phase'], number> = { run: 950, write: 680, done: 1400 };

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

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

export const ThreadGraphSnapshot = () => {
  const reduced = usePrefersReducedMotion();
  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    const id = window.setTimeout(
      () => setBeatIndex((prev) => (prev + 1) % BEATS.length),
      DUR[BEATS[beatIndex].phase],
    );
    return () => window.clearTimeout(id);
  }, [beatIndex, reduced]);

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

  const stateOf = (i: number): 'idle' | 'running' | 'done' | 'pending' => {
    if (beat == null) {
      return 'idle';
    }
    if (beat.phase === 'done' || i < beat.step) {
      return 'done';
    }
    if (i === beat.step) {
      return beat.phase === 'run' ? 'running' : 'done';
    }
    return 'pending';
  };

  const showDecisions = progress >= 2;
  const question = progress < 2 ? 'none' : progress < 4 ? 'open' : 'answered';
  const lastOut = LAST_OUTPUT[progress];

  return (
    <svg
      width="100%"
      viewBox="0 0 400 344"
      role="img"
      aria-label="A workflow run on a password reset, building one shared context as it goes"
      className="mx-auto block max-w-[500px]"
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

      {[68, 130, 192, 254].map((y) => (
        <path
          key={`seq-${y}`}
          d={`M106 ${y} L106 ${y + 12}`}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeOpacity="0.32"
          strokeWidth="1.1"
          markerEnd="url(#tg-arrow)"
        />
      ))}

      {ROWS.map((row, i) => (
        <path
          key={`tap-${row.role}`}
          d={`M198 ${row.y + 24} L214 ${row.y + 24}`}
          fill="none"
          stroke="var(--color-primary)"
          strokeOpacity={stateOf(i) === 'pending' ? 0.16 : 0.38}
          strokeWidth="1.3"
          style={{ transition: 'stroke-opacity 0.3s' }}
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
        const running = stateOf(i) === 'running';
        return (
          <g
            key={row.role}
            style={{ opacity: stateOf(i) === 'pending' ? 0.4 : 1, transition: 'opacity 0.35s' }}
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
        height="296"
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
        Shared context
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
        y="84"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Goal
      </text>
      <text x="230" y="99" className="fill-foreground text-[10.5px]">
        Reset a user&apos;s password
      </text>

      <text
        x="230"
        y="132"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Decisions
      </text>
      {showDecisions ? (
        <text key="dec" x="230" y="147" className="fill-foreground text-[10.5px] tg-fade">
          Stateless JWT, 30-min TTL
        </text>
      ) : (
        <Skeleton y={142} w={118} />
      )}

      <text
        x="230"
        y="180"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        {question === 'answered' ? 'Answered' : 'Open question'}
      </text>
      {question === 'none' ? <Skeleton y={190} w={96} /> : null}
      {question === 'open' ? (
        <g key="q-open" className="tg-fade">
          <circle
            cx="233"
            cy="192"
            r="3"
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth="1.4"
          />
          <text x="244" y="195" className="fill-foreground text-[10.5px]">
            Rate-limit per IP?
          </text>
        </g>
      ) : null}
      {question === 'answered' ? (
        <g key="q-ans" className="tg-fade">
          <path
            d="M230 192 l3 3 L238 188"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="244"
            y="195"
            className="fill-muted-foreground text-[10.5px]"
            style={{ textDecoration: 'line-through' }}
          >
            Rate-limit per IP?
          </text>
        </g>
      ) : null}

      <text
        x="230"
        y="228"
        className="fill-muted-foreground text-[8px] font-semibold uppercase tracking-[0.08em]"
      >
        Last output
      </text>
      {lastOut === '' ? (
        <>
          <Skeleton y={238} w={142} />
          <Skeleton y={247} w={96} />
        </>
      ) : (
        <text key={lastOut} x="230" y="243" className="fill-foreground text-[10.5px] tg-fade">
          {lastOut}
        </text>
      )}

      <text x="230" y="300" className="fill-muted-foreground text-[8.5px]">
        Carried into every step.
      </text>
    </svg>
  );
};
