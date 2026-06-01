import { useEffect, useRef, useState } from 'react';
import { AppCanvas } from './AppCanvas';
import { useScrollTour } from './useScrollTour';
import { CAPTIONS, KEYFRAMES, deriveView, equalView } from './tourScript';

const CANVAS_W = 1180;
const CANVAS_H = 720;
const TRACK_VH = 720;

export function ScrollTour() {
  const { trackRef, stageRef, canvasRef, registerRegion, view, progress, staticMode } =
    useScrollTour({
      keyframes: KEYFRAMES,
      deriveView,
      equal: equalView,
      pad: 0.92,
    });

  if (staticMode) return <StaticTour view={view} registerRegion={registerRegion} />;

  return (
    <section id="tour" ref={trackRef} className="relative" style={{ height: `${TRACK_VH}vh` }}>
      <div
        ref={stageRef}
        className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden"
      >
        <div
          ref={canvasRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: CANVAS_W, height: CANVAS_H }}
        >
          <AppCanvas view={view} registerRegion={registerRegion} />
        </div>

        <CaptionDeck act={view.act} />
        <ProgressBar progress={progress} />
        <ScrollHint hidden={view.act > 0} />
      </div>
    </section>
  );
}

function CaptionDeck({ act }: { act: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center px-6">
      <div className="relative h-[88px] w-full max-w-xl">
        {CAPTIONS.map((c, i) => (
          <div
            key={c.eyebrow}
            className="absolute inset-0 flex flex-col items-center justify-end text-center transition-opacity duration-500"
            style={{ opacity: i === act ? 1 : 0 }}
          >
            <span className="mb-1.5 inline-block rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              {c.eyebrow}
            </span>
            <p className="text-balance text-[17px] font-medium leading-snug text-foreground sm:text-[19px]">
              {c.line}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-border-soft/40">
      <div
        className="h-full origin-left bg-gradient-to-r from-primary to-provider-cursor"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

function ScrollHint({ hidden }: { hidden: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
        Scroll to walk through it
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 3v10M8 13l4-4M8 13l-4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

function StaticTour({
  view,
  registerRegion,
}: {
  view: ReturnType<typeof deriveView>;
  registerRegion: (key: string) => (node: HTMLElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? CANVAS_W;
      setScale(Math.min(1, w / CANVAS_W));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <section id="tour" className="mx-auto max-w-6xl px-6 py-20">
      <div ref={wrapRef} className="overflow-hidden" style={{ height: CANVAS_H * scale }}>
        <div
          className="origin-top-left"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
        >
          <AppCanvas view={view} registerRegion={registerRegion} />
        </div>
      </div>
      <ol className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {CAPTIONS.slice(1).map((c) => (
          <li key={c.eyebrow} className="rounded-lg border border-border-soft bg-subtle/40 p-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
              {c.eyebrow}
            </span>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{c.line}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
