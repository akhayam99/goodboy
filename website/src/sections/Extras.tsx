import './Extras.css';
import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';

type SuggestionProps = {
  readonly open: boolean;
  readonly pressed: boolean;
  readonly text: string;
  readonly accept: string;
  readonly dismiss: string;
};

type TraceProps = {
  readonly children: ReactNode;
};

const BEATS: readonly number[] = [600, 1900, 2060, 3000, 4300, 4460];

const AT_SUGGEST_A = 1;
const AT_PRESS_A = 2;
const AT_ACCEPT_A = 3;
const AT_SUGGEST_B = 4;
const AT_PRESS_B = 5;
const AT_ACCEPT_B = 6;
const AT_LAST = BEATS.length;

const LampGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 3.2a5.8 5.8 0 0 0-3.5 10.4c.6.5 1 1.1 1.1 1.8h4.8c.1-.7.5-1.3 1.1-1.8A5.8 5.8 0 0 0 12 3.2Z" />
    <path d="M9.8 18.3h4.4" />
    <path d="M10.7 21h2.6" />
  </svg>
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

const Suggestion = ({ open, pressed, text, accept, dismiss }: SuggestionProps) => (
  <div className={`ex-sug${open ? ' ex-open' : ''}`}>
    <div className="ex-sugcard">
      <span className="ex-sugglyph">
        <LampGlyph />
      </span>
      <p className="ex-sugtext">{text}</p>
      <span className="ex-sugbtns">
        <span className={`mockbtn ex-accept${pressed ? ' ex-press' : ''}`}>{accept}</span>
        <span className="ex-quiet">{dismiss}</span>
      </span>
    </div>
  </div>
);

const Trace = ({ children }: TraceProps) => (
  <p className="ex-trace">
    <span className="ex-traceglyph">
      <LampGlyph />
    </span>
    {children}
  </p>
);

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

  const openA = stage >= AT_SUGGEST_A && stage < AT_ACCEPT_A;
  const acceptedA = stage >= AT_ACCEPT_A;
  const openB = stage >= AT_SUGGEST_B && stage < AT_ACCEPT_B;
  const acceptedB = stage >= AT_ACCEPT_B;

  return (
    <section className="block" id="extras" aria-labelledby="h2-extras">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-extras">
            Goodboy has opinions
          </h2>
          <p className="sub rv" style={delay(80)}>
            Finish a plan with nothing attached to it and it offers to spawn the implementer.
            Point the biggest model at a one-line rename and it asks whether a lighter one will
            do. One click either way, and it never decides for you.
          </p>
        </div>

        <div className="appframe ex-frame rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, acme / Ship LIN-241</span>
          </div>

          <div className="ex-sec">
            <p className="ex-eyebrow">Plan</p>
            <div className="ex-rail">
              <div className="ex-step">
                <span className="kb planner">planner</span>
                <span className="ex-name">Draft the archive steps</span>
                <span className="ex-st ex-st-done">done</span>
                <span className="ex-prov">Claude Opus</span>
              </div>

              <Suggestion
                open={openA}
                pressed={stage === AT_PRESS_A}
                text="Plan looks ready: Ship LIN-241, bulk archive for notifications. Spawn an implementer to execute it?"
                accept="Spawn implementer"
                dismiss="Not now"
              />

              {acceptedA && <Trace>Implementer spawned from the plan</Trace>}

              {acceptedA && (
                <div className="ex-step ex-new">
                  <span className="kb implementer">implementer</span>
                  <span className="ex-name">Archive endpoint, batches of 500</span>
                  <span className="ex-st ex-st-queued">queued</span>
                  <span className="ex-prov">Codex GPT-5.6 Sol</span>
                </div>
              )}
            </div>
          </div>

          <div className="hairline" />

          <div className="ex-sec">
            <p className="ex-eyebrow">Message</p>
            <div className="ex-composer">
              <p className="ex-typed">Rename the Archive button to Archive all</p>

              <Suggestion
                open={openB}
                pressed={stage === AT_PRESS_B}
                text="Claude Opus for a one-line rename? Claude Haiku 4.5 does this for about a tenth of the price."
                accept="Use Haiku"
                dismiss="Keep Opus"
              />

              {acceptedB && <Trace>Switched to Haiku 4.5 from a suggestion</Trace>}

              <div className="ex-cfoot">
                <span className={`ex-chip${acceptedB ? ' ex-swapped' : ''}`}>
                  <BrandMark brand="anthropic" size={13} />
                  <span>{acceptedB ? 'Claude Haiku 4.5 · Low' : 'Claude Opus · High'}</span>
                </span>
                <span className="ex-send">
                  <SendGlyph />
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          Two nudges, both easy to ignore. You stop ignoring them by day two.
        </p>
      </div>
    </section>
  );
};
