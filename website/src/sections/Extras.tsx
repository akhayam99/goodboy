import './Extras.css';
import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';

type Offer = {
  readonly at: number;
  readonly key: string;
  readonly glyph: ReactNode;
  readonly title: string;
  readonly detail: string | null;
  readonly action: ReactNode;
};

const BEATS: readonly number[] = [320, 700, 1080, 1500, 1900, 2280, 2640];

const AT_TYPED = 4;
const AT_HELD = 5;
const AT_PRESS = 6;
const AT_SWAP = 7;
const AT_LAST = BEATS.length;

const Stroke = ({ children }: { readonly children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const PlayGlyph = () => (
  <Stroke>
    <path d="M7.5 5.2 18.5 12 7.5 18.8Z" />
  </Stroke>
);

const ReplyGlyph = () => (
  <Stroke>
    <path d="M4 5.5h16v10H10l-5 3.5v-3.5H4Z" />
    <path d="M12.4 8.4 9.6 10.9l2.8 2.5" />
    <path d="M9.6 10.9h4a2.4 2.4 0 0 1 2.4 2.4" />
  </Stroke>
);

const RebaseGlyph = () => (
  <Stroke>
    <circle cx="6" cy="18" r="2.6" />
    <circle cx="18" cy="7.4" r="2.6" />
    <path d="M6 15.4V6.6" />
    <path d="m3.4 9.2 2.6-2.6 2.6 2.6" />
    <path d="M18 10v3.4a4 4 0 0 1-4 4h-2" />
  </Stroke>
);

const LampGlyph = () => (
  <Stroke>
    <path d="M12 3.4a5.7 5.7 0 0 0-3.4 10.2c.6.5 1 1.1 1 1.8h4.8c0-.7.4-1.3 1-1.8A5.7 5.7 0 0 0 12 3.4Z" />
    <path d="M9.9 18.3h4.2" />
    <path d="M10.8 20.9h2.4" />
  </Stroke>
);

const SendGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 19V5.4" />
    <path d="m5.6 11.8 6.4-6.4 6.4 6.4" />
  </svg>
);

const OFFERS: readonly Offer[] = [
  {
    at: 1,
    key: 'workflow',
    glyph: <PlayGlyph />,
    title: 'Continue Ship a feature',
    detail: null,
    action: (
      <span className="ex-cta">
        <PlayGlyph />
        Run next step: Archive endpoint
        <span className="ex-badge">GPT-5.6 Sol</span>
      </span>
    ),
  },
  {
    at: 2,
    key: 'threads',
    glyph: <ReplyGlyph />,
    title: 'Resolve review comments',
    detail: '2 comments',
    action: <span className="mockbtn ghost">Resolve</span>,
  },
  {
    at: 3,
    key: 'rebase',
    glyph: <RebaseGlyph />,
    title: 'Rebase api on main',
    detail: '3 behind',
    action: <span className="mockbtn ghost">Rebase</span>,
  },
];

export const Extras = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? AT_LAST : 0));

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const timers = BEATS.map((ms, i) =>
      window.setTimeout(() => setStage((current) => Math.max(current, i + 1)), ms),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView]);

  const swapped = stage >= AT_SWAP;

  return (
    <section className="block" id="extras" aria-labelledby="h2-extras">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-extras">
            It notices the next step and waits
          </h2>
          <p className="sub rv" style={delay(40)}>
            Goodboy reads the state of a task and offers what comes next: the workflow step waiting
            to run, the review comments nobody answered, the branch that fell behind main. Finish a
            plan on its own and it offers to spawn the implementer. Send a one-line rename to the
            biggest model and it holds the message to ask whether a smaller one will do. Each of
            those is one button, and none of them fires itself.
          </p>
        </div>

        <div className="appframe ex-frame rv" style={delay(80)} ref={ref} aria-hidden="true">
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, acme / api / Ship LIN-241</span>
          </div>

          <div className="ex-sec">
            <p className="ex-eyebrow">Suggestions</p>
            <div className="ex-list">
              {OFFERS.map((offer) => (
                <div className={`ex-row${stage >= offer.at ? ' ex-lit' : ''}`} key={offer.key}>
                  <span className="ex-ico">{offer.glyph}</span>
                  <span className="ex-rt">
                    <span className="ex-title">{offer.title}</span>
                    {offer.detail !== null && <span className="ex-detail">{offer.detail}</span>}
                  </span>
                  {offer.action}
                </div>
              ))}
            </div>
          </div>

          <div className="hairline" />

          <div className="ex-sec">
            <div className="ex-composer">
              <p className={`ex-typed${stage >= AT_TYPED ? ' ex-lit' : ''}`}>
                Rename the Archive button to Archive all
              </p>

              <div className={`ex-card${stage >= AT_HELD ? ' ex-lit' : ''}`}>
                <span className="ex-cardglyph">
                  <LampGlyph />
                </span>
                <p className="ex-cardtext">
                  This looks light. Run with <b>Claude Sonnet</b> instead of <b>Claude Opus</b>?
                  <span className="ex-cardsub">About 1.7x cheaper.</span>
                </p>
                <span className="ex-cardbtns">
                  <span className={`mockbtn ex-accept${stage >= AT_PRESS ? ' ex-press' : ''}`}>
                    Use Sonnet
                  </span>
                  <span className="mockbtn ghost">Keep Opus</span>
                  <span className="ex-quiet">Change model…</span>
                </span>
              </div>

              <div className="ex-cfoot">
                <span className="ex-chip">
                  <BrandMark brand="anthropic" size={13} />
                  <span className="ex-chipslot">
                    <span className={swapped ? '' : 'ex-on'}>Claude Opus · High</span>
                    <span className={swapped ? 'ex-on' : ''}>Claude Sonnet · High</span>
                  </span>
                </span>
                <span className="ex-send">
                  <SendGlyph />
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(110)}>
          Three offers sitting on the task, one holding the message you just typed. Ignore all four
          and nothing changes.
        </p>
      </div>
    </section>
  );
};
