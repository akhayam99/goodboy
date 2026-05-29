import { DogMascot } from './DogMascot';

/* The hero showpiece. A goal flows into the Goodboy router on the left, which
   fans out to four providers on the right over live, flowing wires. Pure
   CSS/SVG: the wires are dashed strokes scrolling along their paths
   (vector-effect keeps them crisp at any scale), the router breathes, the
   provider dots pulse in sequence. Collapses to a static diagram under
   reduced motion. */

const PROVIDERS = [
  { name: 'Claude', color: 'oklch(0.74 0.15 55)', y: 40 },
  { name: 'Cursor', color: 'oklch(0.70 0.16 290)', y: 100 },
  { name: 'Codex', color: 'oklch(0.72 0.16 150)', y: 160 },
  { name: 'Gemini', color: 'oklch(0.72 0.16 240)', y: 220 },
] as const;

function wirePath(y: number): string {
  return `M390,130 C 470,130 492,${y} 560,${y}`;
}

export function OrchestrationFlow() {
  return (
    <div className="relative mx-auto h-[256px] w-full max-w-[680px] sm:h-[280px]">
      {/* wire layer */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 720 260"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* goal -> router */}
        <path
          d="M150,130 C 230,130 250,130 330,130"
          fill="none"
          stroke="oklch(0.74 0.11 200 / 0.25)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M150,130 C 230,130 250,130 330,130"
          fill="none"
          stroke="oklch(0.86 0.10 200)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="wire-flow"
        />
        {/* router -> each provider */}
        {PROVIDERS.map((p, i) => (
          <g key={p.name}>
            <path
              d={wirePath(p.y)}
              fill="none"
              stroke={p.color}
              strokeOpacity={0.22}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={wirePath(p.y)}
              fill="none"
              stroke={p.color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="wire-flow"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          </g>
        ))}
      </svg>

      {/* goal node */}
      <div
        className="absolute -translate-y-1/2 rounded-lg border border-border-soft bg-subtle/90 px-3 py-2 shadow-sm backdrop-blur-sm"
        style={{ left: '1%', top: '50%', width: '20%', minWidth: 116 }}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          your goal
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-foreground/80">
          “add password reset”
        </p>
      </div>

      {/* router node: the box is centred on the wire line; the labels hang
         below as an absolute element so they don't shift the box off-centre. */}
      <div className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2">
        <span
          aria-hidden
          className="node-glow absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-xl"
        />
        <span className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-background shadow-md">
          <DogMascot size={32} className="text-primary" />
        </span>
        <span className="absolute left-1/2 top-full mt-1.5 flex -translate-x-1/2 flex-col items-center whitespace-nowrap">
          <span className="text-[11px] font-semibold text-foreground">Goodboy</span>
          <span className="font-mono text-[9px] text-muted-foreground/70">router</span>
        </span>
      </div>

      {/* provider nodes */}
      {PROVIDERS.map((p, i) => (
        <div
          key={p.name}
          className="absolute flex -translate-y-1/2 items-center gap-2 rounded-lg border border-border-soft bg-subtle/90 px-2.5 py-1.5 shadow-sm backdrop-blur-sm"
          style={{ right: '1%', top: `${(p.y / 260) * 100}%`, minWidth: 112 }}
        >
          <span
            className="node-glow size-2.5 shrink-0 rounded-full"
            style={{ background: p.color, animationDelay: `${i * 0.18}s` }}
            aria-hidden
          />
          <span className="text-[12px] font-medium text-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
