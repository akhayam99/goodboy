import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BRAND_PATH } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';

type Spot = { x: number; y: number };

type Beat = 'idle' | 'press' | 'working' | 'committed' | 'reply' | 'hold';

const BEATS: ReadonlyArray<Beat> = ['idle', 'press', 'working', 'committed', 'reply', 'hold'];

const DUR: Record<Beat, number> = {
  idle: 1500,
  press: 550,
  working: 1700,
  committed: 1500,
  reply: 1400,
  hold: 2600,
};

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

type Token = { text: string; kind?: 'keyword' | 'string' | 'number' | 'function' | 'property' };

const TOKEN_COLOR: Record<NonNullable<Token['kind']>, string> = {
  keyword: 'text-[var(--color-syntax-keyword)]',
  string: 'text-[var(--color-syntax-string)]',
  number: 'text-[var(--color-syntax-number)]',
  function: 'text-[var(--color-syntax-function)]',
  property: 'text-[var(--color-syntax-property)]',
};

type Line = {
  old?: number;
  next?: number;
  sign: ' ' | '+';
  tokens: ReadonlyArray<Token>;
};

const IMPORT_LINE: Line = {
  next: 13,
  sign: '+',
  tokens: [
    { text: 'import', kind: 'keyword' },
    { text: ' { config } ' },
    { text: 'from', kind: 'keyword' },
    { text: ' ' },
    { text: "'../config'", kind: 'string' },
    { text: ';' },
  ],
};

const TTL_BEFORE: ReadonlyArray<Token> = [
  { text: '  ' },
  { text: 'const', kind: 'keyword' },
  { text: ' ttlMs = ' },
  { text: '30', kind: 'number' },
  { text: ' * ' },
  { text: '60', kind: 'number' },
  { text: ' * ' },
  { text: '1000', kind: 'number' },
  { text: ';' },
];

const TTL_AFTER: ReadonlyArray<Token> = [
  { text: '  ' },
  { text: 'const', kind: 'keyword' },
  { text: ' ttlMs = config.auth.' },
  { text: 'resetTokenTtlMs', kind: 'property' },
  { text: ';' },
];

const HEAD_LINES: ReadonlyArray<Line> = [
  {
    old: 12,
    next: 12,
    sign: ' ',
    tokens: [
      { text: 'import', kind: 'keyword' },
      { text: ' { sign } ' },
      { text: 'from', kind: 'keyword' },
      { text: ' ' },
      { text: "'./jwt'", kind: 'string' },
      { text: ';' },
    ],
  },
];

const MID_LINES: ReadonlyArray<Line> = [
  {
    old: 13,
    next: 14,
    sign: ' ',
    tokens: [
      { text: 'export const ', kind: 'keyword' },
      { text: 'createResetToken', kind: 'function' },
      { text: ' = (userId: string) => {' },
    ],
  },
  {
    old: 14,
    next: 15,
    sign: ' ',
    tokens: [
      { text: '  ' },
      { text: 'const', kind: 'keyword' },
      { text: ' issuedAt = Date.' },
      { text: 'now', kind: 'function' },
      { text: '();' },
    ],
  },
];

const TAIL_LINES: ReadonlyArray<Line> = [
  {
    next: 17,
    sign: '+',
    tokens: [
      { text: '  ' },
      { text: 'return', kind: 'keyword' },
      { text: ' ' },
      { text: 'sign', kind: 'function' },
      { text: '({ userId, exp: issuedAt + ttlMs });' },
    ],
  },
  { old: 15, next: 18, sign: ' ', tokens: [{ text: '};' }] },
];

const Code = ({ tokens }: { tokens: ReadonlyArray<Token> }) => (
  <>
    {tokens.map((token, i) => (
      <span key={i} className={token.kind ? TOKEN_COLOR[token.kind] : undefined}>
        {token.text}
      </span>
    ))}
  </>
);

const DiffLine = ({
  line,
  flagged,
  hidden,
}: {
  line: Line;
  flagged?: boolean;
  hidden?: boolean;
}) => (
  <div
    className={`flex h-[18px] items-center whitespace-pre font-mono text-[10px] leading-[18px] ${
      line.sign === '+' ? 'bg-success/[0.07]' : ''
    } ${flagged ? 'bg-warning/[0.06]' : ''}`}
    style={hidden ? { opacity: 0 } : undefined}
  >
    <span
      className={`h-full w-[2px] shrink-0 ${line.sign === '+' ? 'bg-success/50' : 'bg-transparent'}`}
    />
    <span className="hidden w-8 shrink-0 pr-2 text-right text-[9px] tabular-nums text-muted-foreground/45 sm:block">
      {line.old ?? ''}
    </span>
    <span className="w-8 shrink-0 border-r border-border-soft/40 pr-2 text-right text-[9px] tabular-nums text-muted-foreground/45">
      {line.next ?? ''}
    </span>
    <span
      className={`w-4 shrink-0 select-none pl-2 ${line.sign === '+' ? 'text-success' : 'text-transparent'}`}
    >
      {line.sign}
    </span>
    <span className="min-w-0 truncate text-foreground/90">
      <Code tokens={line.tokens} />
    </span>
  </div>
);

const AnthropicGlyph = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH.anthropic} fill="var(--color-provider-anthropic)" />
  </svg>
);

const CheckGlyph = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
    <path
      d="M5 12.5 9.5 17 19 6.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Cursor = ({ pressed }: { pressed: boolean }) => (
  <svg
    width="15"
    height="19"
    viewBox="0 0 15 19"
    fill="none"
    aria-hidden
    style={{
      transform: pressed ? 'scale(0.88)' : 'scale(1)',
      transformOrigin: '2px 2px',
      transition: 'transform 140ms ease-out',
    }}
  >
    <path
      d="M1.5 1.2 12.4 9.6l-4.6.5 2.5 5.5-2.2 1-2.5-5.5-3.1 3.4z"
      fill="var(--color-foreground)"
      stroke="var(--color-background)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const ResolveInDiff = () => {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useToggleInView<HTMLDivElement>();
  const [beatIndex, setBeatIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [fading, setFading] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef<HTMLSpanElement | null>(null);
  const [spots, setSpots] = useState<{ rest: Spot; target: Spot } | null>(null);
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      const action = actionRef.current;
      if (!stage || !action) {
        return;
      }
      const box = stage.getBoundingClientRect();
      const hit = action.getBoundingClientRect();
      setSpots({
        rest: { x: box.width * 0.66, y: box.height * 0.82 },
        target: {
          x: hit.left - box.left + hit.width * 0.58,
          y: hit.top - box.top + hit.height * 0.5,
        },
      });
    };
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) {
      return undefined;
    }
    if (fading) {
      const id = window.setTimeout(() => {
        setBeatIndex(0);
        setLoopCount((c) => c + 1);
        setFading(false);
      }, 350);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      if (beatIndex === BEATS.length - 1) {
        setFading(true);
      } else {
        setBeatIndex((b) => b + 1);
      }
    }, DUR[BEATS[beatIndex]]);
    return () => window.clearTimeout(id);
  }, [beatIndex, fading, reduced, inView]);

  const beat = reduced ? 'hold' : BEATS[beatIndex];

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    if (beat === 'idle') {
      setArmed(false);
      const id = window.setTimeout(() => setArmed(true), 220);
      return () => window.clearTimeout(id);
    }
    if (beat === 'working') {
      setArmed(false);
    }
    return undefined;
  }, [beat, reduced]);

  const working = beat === 'working';
  const fixed = beat === 'committed' || beat === 'reply' || beat === 'hold';
  const replied = beat === 'reply' || beat === 'hold';
  const held = beat === 'hold';

  return (
    <div ref={ref} aria-hidden="true" className="w-full">
      <div className="flex h-6 items-center justify-between gap-3 px-0.5 text-[9.5px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-foreground/70">src/auth/resetToken.ts</span>
          <span className="shrink-0 tabular-nums text-success">+{fixed ? 4 : 3}</span>
        </span>
        <span className="shrink-0 font-mono tabular-nums">
          1 unresolved · {beat === 'idle' || beat === 'press' ? '$0.87' : '$0.94'} today
        </span>
      </div>

      <div
        ref={stageRef}
        className="relative mt-2 overflow-hidden rounded-lg border border-border-soft/60 bg-subtle/30"
        style={
          reduced
            ? undefined
            : { opacity: fading ? 0 : 1, transition: 'opacity 350ms cubic-bezier(0.2, 0, 0, 1)' }
        }
      >
        <div className="flex h-[18px] items-center border-b border-border-soft/40 bg-muted/25 px-3 font-mono text-[9px] leading-[18px] tabular-nums text-muted-foreground/70">
          @@ -12,4 +12,8 @@ createResetToken
        </div>

        {HEAD_LINES.map((line, i) => (
          <DiffLine key={`head-${i}`} line={line} />
        ))}
        <DiffLine line={IMPORT_LINE} hidden={!fixed} />
        {MID_LINES.map((line, i) => (
          <DiffLine key={`mid-${i}`} line={line} />
        ))}
        <DiffLine
          line={{
            next: 16,
            sign: '+',
            tokens: fixed ? TTL_AFTER : TTL_BEFORE,
          }}
          flagged={!fixed}
        />

        <div className="border-y border-border-soft/40 bg-background px-3 py-2.5">
          <div className="flex h-[14px] items-center gap-1.5 leading-[14px]">
            <span className="inline-flex size-[14px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[7px] font-semibold text-primary">
              JA
            </span>
            <span className="text-[9.5px] font-medium text-foreground">Jordan Avery</span>
            <span className="text-[9px] text-muted-foreground/60">commented on line 16</span>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-snug text-foreground/90">
            The TTL is hardcoded here. Read it from config instead.
          </p>

          <div className="mt-2 flex h-[20px] items-center gap-2 text-[9.5px] leading-[20px]">
            {beat === 'idle' || beat === 'press' ? (
              <span
                ref={actionRef}
                className="relative inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-0.5 text-muted-foreground"
              >
                Resolve with
                <AnthropicGlyph />
                Sonnet 5
                {beat === 'press' && !reduced ? (
                  <span
                    key={loopCount}
                    className="press-ring"
                    style={{ left: '50%', top: '50%' }}
                  />
                ) : null}
              </span>
            ) : working ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-primary/[0.06] px-2 py-0.5 text-primary">
                <span
                  className="size-1.5 rounded-full bg-primary"
                  style={{ animation: 'soft-pulse 1.4s ease-in-out infinite' }}
                />
                resolver working
                <AnthropicGlyph />
                Sonnet 5
              </span>
            ) : (
              <span className="tg-fade inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/[0.07] px-2 py-0.5 text-success">
                <CheckGlyph />
                committed <span className="font-mono">a41f9c2</span>
              </span>
            )}
          </div>

          <div className="mt-1.5 flex h-[16px] items-center gap-2 text-[9.5px] leading-[16px]">
            {replied ? (
              <Fragment>
                <span className="tg-fade truncate text-muted-foreground">
                  Draft reply: reads the TTL from config now.
                </span>
                <span className="tg-fade chip chip-info shrink-0">not published</span>
              </Fragment>
            ) : null}
          </div>
        </div>

        {TAIL_LINES.map((line, i) => (
          <DiffLine key={`tail-${i}`} line={line} />
        ))}

        {!reduced && spots != null ? (
          <span
            className="pointer-events-none absolute left-0 top-0 z-10"
            style={{
              transform: `translate(${armed ? spots.target.x : spots.rest.x}px, ${
                armed ? spots.target.y : spots.rest.y
              }px)`,
              transition: 'transform 620ms cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            <Cursor pressed={beat === 'press'} />
          </span>
        ) : null}
      </div>

      <div
        className={`mt-2 flex h-[34px] items-center justify-between gap-3 rounded-lg border px-3 ${
          held ? 'border-border-soft/60 bg-subtle/40' : 'border-transparent'
        }`}
      >
        {held ? (
          <Fragment>
            <span className="tg-fade truncate text-[9.5px] text-muted-foreground">
              1 local commit on{' '}
              <span className="font-mono text-foreground">feat/password-reset</span> · nothing
              pushed
            </span>
            <span className="tg-fade chip chip-primary shrink-0">Push batch</span>
          </Fragment>
        ) : null}
      </div>
    </div>
  );
};
