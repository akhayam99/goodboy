import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type StepRow = {
  readonly kind: 'scout' | 'planner' | 'implementer' | 'reviewer' | 'prrev';
  readonly label: string;
  readonly brand: BrandId;
  readonly model: string;
  readonly effort: string;
  readonly cost: string;
  readonly hi?: boolean;
  readonly star?: boolean;
};

const STEPS: readonly StepRow[] = [
  {
    kind: 'scout',
    label: 'scout',
    brand: 'codex',
    model: 'gpt 5.6 codex',
    effort: 'low',
    cost: '$0.02',
  },
  {
    kind: 'planner',
    label: 'planner',
    brand: 'anthropic',
    model: 'claude opus',
    effort: 'high',
    cost: '$0.48',
    hi: true,
    star: true,
  },
  {
    kind: 'implementer',
    label: 'implementer',
    brand: 'anthropic',
    model: 'claude sonnet',
    effort: 'medium',
    cost: '$0.14',
  },
  {
    kind: 'reviewer',
    label: 'reviewer',
    brand: 'gemini',
    model: 'gemini',
    effort: 'medium',
    cost: '$0.06',
  },
  {
    kind: 'prrev',
    label: 'pr-reviewer',
    brand: 'codex',
    model: 'gpt 5.6 codex',
    effort: 'low',
    cost: '$0.03',
  },
];

const CTX_BARS = [
  { className: 'cb', width: 30, history: 'history 34k', delayMs: 500 },
  { className: 'cb warm', width: 62, history: 'history 96k', delayMs: 1400 },
  { className: 'cb bad', width: 92, history: 'history 168k', delayMs: 2300 },
] as const;

export const Routing = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const reduced = prefersReducedMotion();
  const play = inView || reduced;

  return (
    <section className="block" id="routing" aria-labelledby="h2-routing">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-routing">
            The same task, two very different bills
          </h2>
          <p className="sub rv" style={delay(80)}>
            Each step gets the model that fits:{' '}
            <b>cheap to look around, strong where the thinking is hard</b>. You choose the workflow,
            and a pinned step wins.
          </p>
        </div>

        <div className="contrast rv" style={delay(160)} ref={ref}>
          <div className="panel dull">
            <div className="phead">
              One tool, one model, one session
              <span className="tag">one provider does every step</span>
            </div>
            <div className="pbody">
              <div className="pickrow">
                <span className="pick">
                  <BrandMark brand="anthropic" size={13} />
                  claude opus<span className="eff">high</span>
                  <span className="car">▾</span>
                </span>
                <span className="note">the big model, just to look around</span>
              </div>
              <div className="gbrow right">
                <div className="gb me">
                  Move session storage off localStorage, keep it reversible, no new deps.
                </div>
              </div>
              <div className="ctxbar">
                <span className="track">
                  <span
                    className={CTX_BARS[0].className}
                    style={
                      play
                        ? {
                            width: `${CTX_BARS[0].width}%`,
                            ...delay(reduced ? 0 : CTX_BARS[0].delayMs),
                          }
                        : { width: 0 }
                    }
                  />
                </span>
                <span className="cl">{CTX_BARS[0].history}</span>
              </div>
              <div className="turncost">
                <div className="gb">Found the call sites. The adapter owns the mirror.</div>
                <span className="tc">$0.62</span>
              </div>
              <div className="pickrow">
                <span className="pick">
                  <BrandMark brand="anthropic" size={13} />
                  claude opus<span className="eff">high</span>
                  <span className="car">▾</span>
                </span>
                <span className="note">the big model, for a small step</span>
              </div>
              <div className="gbrow right">
                <div className="gb me">Now patch the adapter, keep the flag until v0.2.</div>
              </div>
              <div className="ctxbar">
                <span className="track">
                  <span
                    className={CTX_BARS[1].className}
                    style={
                      play
                        ? {
                            width: `${CTX_BARS[1].width}%`,
                            ...delay(reduced ? 0 : CTX_BARS[1].delayMs),
                          }
                        : { width: 0 }
                    }
                  />
                </span>
                <span className="cl">{CTX_BARS[1].history}</span>
              </div>
              <div className="turncost">
                <div className="gb">Patched the adapter, rerunning the suite.</div>
                <span className="tc">$1.44</span>
              </div>
              <div className="ctxbar">
                <span className="track">
                  <span
                    className={CTX_BARS[2].className}
                    style={
                      play
                        ? {
                            width: `${CTX_BARS[2].width}%`,
                            ...delay(reduced ? 0 : CTX_BARS[2].delayMs),
                          }
                        : { width: 0 }
                    }
                  />
                </span>
                <span className="cl">{CTX_BARS[2].history}</span>
              </div>
            </div>
            <div className="pfoot hot">
              One model for every job, big or small<span className="tot">$4.90</span>
            </div>
          </div>
          <span className="vs" aria-hidden="true">
            vs
          </span>
          <div className="panel">
            <div className="phead">
              The same task, five steps<span className="tag">Goodboy routes each step</span>
            </div>
            <div className="pbody">
              <div className="briefrow">
                <span className="briefchip">
                  briefing<i>goal</i>
                  <i>decisions</i>
                  <i>summary</i>
                </span>
                <span className="note">written once, read by every step</span>
              </div>
              <div className="rail">
                {STEPS.map((step, i) => (
                  <div
                    key={step.kind}
                    className={step.star ? 'steprow star rv' : 'steprow rv'}
                    style={delay(reduced ? 0 : 400 + i * 220)}
                  >
                    <span className={`kb ${step.kind}`}>{step.label}</span>
                    <span className="model">
                      <BrandMark brand={step.brand} size={13} />
                      <span>{step.model}</span>
                    </span>
                    <span className="eff">{step.effort}</span>
                    <span className={step.hi ? 'c hi' : 'c'}>{step.cost}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pfoot cool">
              Strong where it matters, cheap everywhere else<span className="tot">$0.73</span>
            </div>
          </div>
        </div>
        <p className="caption rv" style={delay(220)}>
          Set a budget and Goodboy taps you on the shoulder before you cross it, not after.
        </p>
        <a className="more rv" style={delay(260)} href={`${SITE.vision}#provider-routing--balance`}>
          See how routing works <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
