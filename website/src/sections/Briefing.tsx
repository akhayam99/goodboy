import './Briefing.css';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrandMark } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type Slot = { readonly title: string; readonly text: string };

type Wire = { readonly d: string; readonly len: number };

const SLOTS: readonly Slot[] = [
  { title: 'Goal', text: 'Ship LIN-241, bulk archive for notifications.' },
  { title: 'Decisions', text: 'Soft delete only. Batches of 500. No schema change.' },
  { title: 'Summary', text: 'Archive endpoint done, list view wired, empty-state copy still ahead.' },
];

const BEATS: readonly number[] = [700, 1300, 1520, 1740, 2300, 2600];

const AT_SWITCH = 1;
const AT_FIRST_CARD = 2;
const AT_TAG = 5;
const AT_REPLY = 6;
const AT_LAST = BEATS.length;

const WIDE_AT = 760;
const MIN_RUN = 40;

const lenStyle = (len: number) => ({ '--len': `${len.toFixed(1)}px` }) as CSSProperties;

const round = (value: number) => value.toFixed(1);

const wireOf = (x0: number, y0: number, x1: number, y1: number, at: number): Wire => {
  const xm = x0 + (x1 - x0) * at;
  const dy = y1 - y0;
  const dir = dy < 0 ? -1 : 1;
  const r = Math.min(9, Math.abs(dy) / 2, (xm - x0) / 2, (x1 - xm) / 2);
  if (r < 1) {
    return { d: `M${round(x0)} ${round(y0)}L${round(x1)} ${round(y1)}`, len: Math.hypot(x1 - x0, dy) };
  }
  const d = [
    `M${round(x0)} ${round(y0)}`,
    `L${round(xm - r)} ${round(y0)}`,
    `Q${round(xm)} ${round(y0)} ${round(xm)} ${round(y0 + dir * r)}`,
    `L${round(xm)} ${round(y1 - dir * r)}`,
    `Q${round(xm)} ${round(y1)} ${round(xm + r)} ${round(y1)}`,
    `L${round(x1)} ${round(y1)}`,
  ].join('');
  const len = xm - r - x0 + (Math.abs(dy) - 2 * r) + (x1 - xm - r) + 3 * r;
  return { d, len };
};

export const Briefing = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [reduced] = useState(prefersReducedMotion);
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? AT_LAST : 0));
  const [wires, setWires] = useState<readonly Wire[]>([]);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const timers = BEATS.map((ms, i) =>
      window.setTimeout(() => setStage((current) => Math.max(current, i + 1)), ms),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView]);

  useEffect(() => {
    const grid = gridRef.current;
    if (grid == null) {
      return;
    }
    const measure = () => {
      const head = headRef.current;
      if (head == null || window.innerWidth < WIDE_AT) {
        setWires([]);
        return;
      }
      const box = grid.getBoundingClientRect();
      const hb = head.getBoundingClientRect();
      const x1 = hb.left - box.left;
      const y1 = hb.top + hb.height / 2 - box.top;
      const next: Wire[] = [];
      SLOTS.forEach((_, i) => {
        const card = cardRefs.current[i];
        if (card == null) {
          return;
        }
        const cb = card.getBoundingClientRect();
        const x0 = cb.right - box.left;
        const y0 = cb.top + cb.height / 2 - box.top;
        if (x1 - x0 < MIN_RUN) {
          return;
        }
        next.push(wireOf(x0, y0, x1, y1, 0.34 + i * 0.16));
      });
      setWires(next.length === SLOTS.length ? next : []);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  const onCodex = stage >= AT_SWITCH;

  return (
    <section className="block alt" id="briefing" aria-labelledby="h2-brief">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-brief">
            The briefing belongs to the task, not the chat
          </h2>
          <p className="sub rv" style={delay(80)}>
            Write the goal once and <b>every agent that touches the task starts informed</b>. Swap
            models mid-task or step away for a day, and nothing needs re&#8209;explaining.
          </p>
        </div>

        <div className="appframe br-frame rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, acme / Ship LIN-241</span>
          </div>

          <div className="br-grid" ref={gridRef}>
            <svg className="br-wires" aria-hidden="true" focusable="false">
              {wires.map((w, i) => (
                <g className={stage >= AT_FIRST_CARD + i ? 'br-lit' : undefined} key={w.d}>
                  <path className="br-track" d={w.d} style={lenStyle(w.len)} />
                  {!reduced && stage >= AT_FIRST_CARD + i ? (
                    <path className="br-trav" d={w.d} style={lenStyle(w.len)} />
                  ) : null}
                </g>
              ))}
            </svg>

            <div className="br-col">
              <p className="br-eyebrow">Task</p>
              <div className="br-cards">
                {SLOTS.map((slot, i) => (
                  <div
                    className="br-card"
                    data-lit={stage >= AT_FIRST_CARD + i ? 'y' : undefined}
                    key={slot.title}
                    ref={(node) => {
                      cardRefs.current[i] = node;
                    }}
                  >
                    <p className="br-cardtitle">{slot.title}</p>
                    <p className="br-cardtext">{slot.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="br-col">
              <p className="br-eyebrow">Chat</p>
              <div className="br-pane">
                <div className="br-phead" ref={headRef}>
                  <span className="br-pchip">
                    <span className="br-pswap">
                      <span className={`br-popt${onCodex ? '' : ' br-on'}`}>
                        <BrandMark brand="anthropic" size={14} />
                        Claude Sonnet
                      </span>
                      <span className={`br-popt${onCodex ? ' br-on' : ''}`}>
                        <BrandMark brand="codex" size={14} />
                        Codex GPT-5.6 Sol
                      </span>
                    </span>
                  </span>
                  <span className="br-tagslot">
                    {stage >= AT_TAG ? <span className="br-tag">briefed from the task</span> : null}
                  </span>
                </div>

                <div className="br-msgs">
                  <div className="br-mine">
                    <p className="br-msg br-msgme">Tests are red on the empty state.</p>
                  </div>

                  <div className="br-agent">
                    <span className="br-av">
                      <BrandMark brand="anthropic" size={13} />
                    </span>
                    <p className="br-msg">
                      The empty state skips the soft-delete flag. Patching the list view, keeping
                      batches at 500.
                    </p>
                  </div>

                  <div className={`br-event${onCodex ? ' br-show' : ''}`}>
                    <span className="hairline" />
                    <p className="br-eventtext">
                      <span className="br-dot" />
                      You moved the task to Codex at 12:38
                    </p>
                    <span className="hairline" />
                  </div>

                  {stage >= AT_REPLY ? (
                    <div className="br-agent br-new">
                      <span className="br-av">
                        <BrandMark brand="codex" size={13} />
                      </span>
                      <p className="br-msg">
                        Flag honoured in the empty state, 12 tests green. Summary updated for whoever
                        comes next.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          A chat tool loses the thread when you switch, and Goodboy keeps it with the task.
        </p>
        <a className="more rv" style={delay(220)} href={`${SITE.concepts}#shared-context`}>
          How shared context works <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
