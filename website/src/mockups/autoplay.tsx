import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useInView } from '../components/Reveal';

export interface Pos {
  x: number;
  y: number;
}

export interface Cursor {
  x: number;
  y: number;
  visible: boolean;
  pressing: boolean;
}

const HIDDEN: Cursor = { x: 24, y: 24, visible: false, pressing: false };

export type Beat<A> =
  | { d: number; kind: 'move'; to: string | null }
  | { d: number; kind: 'press' }
  | { d: number; kind: 'act'; act: A }
  | { d: number; kind: 'reset' };

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Internal<S> {
  content: S;
  cursor: Cursor;
}

type Meta<A> =
  | { m: 'cursor'; pos: Pos | null }
  | { m: 'press' }
  | { m: 'act'; a: A }
  | { m: 'reset' }
  | { m: 'static' };

interface AutoplayConfig<S, A> {
  initial: S;
  reducer: (state: S, action: A) => S;
  script: ReadonlyArray<Beat<A>>;
  staticState: S;
}

export function useAutoplay<S, A>({ initial, reducer, script, staticState }: AutoplayConfig<S, A>) {
  const meta = useCallback(
    (state: Internal<S>, action: Meta<A>): Internal<S> => {
      switch (action.m) {
        case 'cursor':
          return action.pos
            ? {
                ...state,
                cursor: { x: action.pos.x, y: action.pos.y, visible: true, pressing: false },
              }
            : { ...state, cursor: { ...state.cursor, visible: false, pressing: false } };
        case 'press':
          return { ...state, cursor: { ...state.cursor, pressing: true } };
        case 'act':
          return {
            content: reducer(state.content, action.a),
            cursor: { ...state.cursor, pressing: false },
          };
        case 'reset':
          return { content: initial, cursor: HIDDEN };
        case 'static':
          return { content: staticState, cursor: HIDDEN };
        default:
          return state;
      }
    },
    [reducer, initial, staticState],
  );

  const [state, dispatch] = useReducer(meta, { content: initial, cursor: HIDDEN });
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const targets = useRef(new Map<string, HTMLElement>());
  const refCache = useRef(new Map<string, (node: HTMLElement | null) => void>());

  const stageRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node;
      inViewRef.current = node;
    },
    [inViewRef],
  );

  const registerTarget = useCallback((key: string) => {
    let cb = refCache.current.get(key);
    if (!cb) {
      cb = (node: HTMLElement | null) => {
        if (node) targets.current.set(key, node);
        else targets.current.delete(key);
      };
      refCache.current.set(key, cb);
    }
    return cb;
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      dispatch({ m: 'static' });
      return;
    }
    const measure = (key: string | null): Pos | null => {
      const stage = stageRef.current;
      if (!stage || !key) return null;
      const el = targets.current.get(key);
      if (!el) return null;
      const sr = stage.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return { x: er.left - sr.left + er.width / 2, y: er.top - sr.top + er.height / 2 };
    };
    let timer: ReturnType<typeof setTimeout>;
    const apply = (beat: Beat<A>) => {
      switch (beat.kind) {
        case 'move':
          dispatch({ m: 'cursor', pos: measure(beat.to) });
          break;
        case 'press':
          dispatch({ m: 'press' });
          break;
        case 'act':
          dispatch({ m: 'act', a: beat.act });
          break;
        case 'reset':
          dispatch({ m: 'reset' });
          break;
      }
    };
    const run = (i: number) => {
      timer = setTimeout(() => {
        apply(script[i]);
        run((i + 1) % script.length);
      }, script[i].d);
    };
    run(0);
    return () => clearTimeout(timer);
  }, [inView, script]);

  return { state: state.content, cursor: state.cursor, stageRef: stageRefCallback, registerTarget };
}

export function SimCursor({ cursor }: { cursor: Cursor }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20 transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(.4,0,.2,1)]"
      style={{
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        opacity: cursor.visible ? 1 : 0,
      }}
    >
      {cursor.pressing && <span className="press-ring" />}
      <svg width="16" height="22" viewBox="0 0 14 20" className="drop-shadow-md" aria-hidden>
        <path
          d="M1 1 L1 16 L4.8 12.4 L7.6 18.7 L10.1 17.5 L7.3 11.3 L12.6 11.1 Z"
          fill="white"
          stroke="oklch(0.2 0.01 255)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
