import { useToggleInView } from '../components/Reveal';
import { useCycle, usePrefersReducedMotion } from './motion';

type Line = {
  kind: 'cmd' | 'out' | 'link';
  text: string;
};

const LINES: ReadonlyArray<Line> = [
  { kind: 'cmd', text: 'pnpm dev' },
  { kind: 'out', text: 'VITE v6.3.5  ready in 312 ms' },
  { kind: 'link', text: '➜  Local:   http://localhost:1420/' },
  { kind: 'cmd', text: 'git status -sb' },
  { kind: 'out', text: '## ak/webhook-retry-guard' },
];

export const TerminalPane = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(LINES.length + 2, 1500, inView && !reduced);
  const visible = reduced ? LINES.length : Math.min(LINES.length, beat + 1);

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full overflow-hidden rounded-xl border border-border-soft/70 bg-[oklch(0.23_0.01_260)] shadow-sm"
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-white/10 px-2.5">
        <span className="flex gap-1.5 pr-2">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[9.5px] font-medium text-white/80">
          zsh · website
        </span>
        <span className="px-2 py-0.5 text-[9.5px] text-white/40">logs</span>
        <span className="px-1.5 py-0.5 text-[10px] text-white/40">+</span>
        <span className="ml-auto text-[9px] uppercase tracking-[0.08em] text-white/30">
          GPU renderer
        </span>
      </div>

      <div className="flex min-h-[148px] flex-col gap-1 p-3 font-mono text-[10.5px] leading-[1.6]">
        {LINES.slice(0, visible).map((line, i) => (
          <span key={i} className="tg-fade whitespace-pre text-white/80">
            {line.kind === 'cmd' ? (
              <>
                <span className="text-[oklch(0.74_0.15_150)]">❯ </span>
                {line.text}
              </>
            ) : (
              <span className={line.kind === 'link' ? 'text-sky-300/90' : 'text-white/55'}>
                {line.text}
              </span>
            )}
          </span>
        ))}
        <span className="flex items-center text-white/80">
          <span className="text-[oklch(0.74_0.15_150)]">❯ </span>
          <span className="pulse ml-0.5 inline-block h-3 w-[7px] bg-white/60" />
        </span>
      </div>
    </div>
  );
};
