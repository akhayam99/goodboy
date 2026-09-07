import './Integrations.css';
import { useEffect, useState, type CSSProperties } from 'react';
import { BrandMark, BRAND_COLOR, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type IntegrationCard = {
  readonly brand: BrandId;
  readonly name: string;
};

const CARDS: ReadonlyArray<IntegrationCard> = [
  { brand: 'github', name: 'GitHub' },
  { brand: 'gitlab', name: 'GitLab' },
  { brand: 'bitbucket', name: 'Bitbucket' },
  { brand: 'linear', name: 'Linear' },
  { brand: 'jira', name: 'Jira' },
  { brand: 'sentry', name: 'Sentry' },
  { brand: 'slack', name: 'Slack' },
];

const ArrowGlyph = () => (
  <svg viewBox="0 0 28 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M1 6h22" strokeLinecap="round" />
    <path d="M18.6 2.2 22.8 6l-4.2 3.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BackGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M6.6 2 2.4 6l4.2 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CommitGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="8" cy="8" r="3" />
    <path d="M1.6 8h3.4M11 8h3.4" strokeLinecap="round" />
  </svg>
);

const CheckGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M2.6 8.6 6 12l7.4-8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UploadGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M8 10.6V2.4" strokeLinecap="round" />
    <path d="M4.8 5.6 8 2.4l3.2 3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M2.4 11.2v1.6a1.6 1.6 0 0 0 1.6 1.6h8a1.6 1.6 0 0 0 1.6-1.6v-1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const STAGE_MS = [180, 840, 1500, 2000, 2470, 3160, 3820, 4360] as const;
const MAX_STAGE = 8;

const IntegrationsFlow = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [reduced] = useState(prefersReducedMotion);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduced) {
      setStage(MAX_STAGE);
      return;
    }
    if (!inView) return;
    const timers = STAGE_MS.map((ms, index) =>
      window.setTimeout(() => setStage(index + 1), ms),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [inView, reduced]);

  const on = (step: number) => (stage >= step ? ' on' : '');

  return (
    <div className="ig-flow" ref={ref} aria-hidden="true">
      <div className={`ig-st ig-comment${on(1)}`}>
        <span className="ig-step">1</span>
        <div className="ig-cwho">
          <span className="ig-av">s</span>
          <span className="ig-cname">sam</span>
          <BrandMark brand="github" size={11} />
          <span className="ig-con">on PR #1045</span>
        </div>
        <p className="ig-ctext">Can we reuse the storage adapter here instead of a new helper?</p>
      </div>

      <div className={`ig-arr${on(2)}`}>
        <ArrowGlyph />
      </div>

      <div className={`ig-st ig-res${on(2)}`}>
        <span className="ig-step">2</span>
        <div className="ig-rrow">
          <span className="kb ig-k-resolver">resolver</span>
          <span className="ig-model">
            <BrandMark brand="anthropic" size={12} />
            <span>Claude Sonnet</span>
          </span>
        </div>
        <div className="ig-readout">
          <span className={stage === 2 ? 'ig-ro on' : 'ig-ro'}>
            <span className="ig-dot" />
            reading the diff
          </span>
          <span className={stage >= 3 ? 'ig-ro ig-ro-done on' : 'ig-ro ig-ro-done'}>
            <CheckGlyph />
            fix ready
          </span>
        </div>
      </div>

      <div className={`ig-arr${on(4)}`}>
        <ArrowGlyph />
      </div>

      <div className={`ig-st ig-commit${on(4)}`}>
        <span className="ig-step">3</span>
        <div className="ig-crow">
          <CommitGlyph />
          <span className="mono ig-hash">a3f19c2</span>
        </div>
        <p className="ig-cmsg">reuse StorageAdapter in bulk archive</p>
        <div className="ig-diff mono">
          <span className="ig-add">+12</span>
          <span className="ig-del">-31</span>
        </div>
      </div>

      <div className={`ig-arr${on(5)}`}>
        <ArrowGlyph />
      </div>

      <div className={`ig-st ig-push${on(5)}`}>
        <span className="ig-step">4</span>
        <span className="ig-pushbtn">
          <UploadGlyph />
          Push and resolve
        </span>
        <span className="ig-pushnote">one click, every thread answered</span>
      </div>

      <div className="ig-rule" />

      <div className={`ig-st ig-comment ig-second${on(6)}`}>
        <div className="ig-cwho">
          <span className="ig-av">s</span>
          <span className="ig-cname">sam</span>
          <BrandMark brand="github" size={11} />
          <span className="ig-con">on PR #1045</span>
        </div>
        <p className="ig-ctext">Should we drop the legacy flag too?</p>
      </div>

      <div className={`ig-arr${on(6)}`}>
        <ArrowGlyph />
      </div>

      <div className={`ig-st ig-res${on(6)}`}>
        <div className="ig-rrow">
          <span className="kb ig-k-resolver">resolver</span>
          <span className="ig-model">
            <BrandMark brand="anthropic" size={12} />
            <span>Claude Sonnet</span>
          </span>
        </div>
        <div className="ig-readout">
          <span className={stage === 6 ? 'ig-ro on' : 'ig-ro'}>
            <span className="ig-dot" />
            reading the diff
          </span>
          <span className={stage >= 7 ? 'ig-ro ig-ro-warn on' : 'ig-ro ig-ro-warn'}>
            no fix needed
          </span>
        </div>
      </div>

      <div className={`ig-arr${on(7)}`}>
        <ArrowGlyph />
      </div>

      <div className={`ig-st ig-wontfix${on(7)}`}>
        <span className="ig-wfchip">Not worth the change</span>
        <p className="ig-wfnote">
          <span className="mono ig-wftag">wontfix:</span> the flag still guards the old rows
        </p>
      </div>

      <div className={`ig-return${on(8)}`}>
        <span className="ig-retarrow">
          <BackGlyph />
        </span>
        <span className="ig-retline" />
        <span className="ig-retlabel">posted on the thread as a reply</span>
        <span className="ig-retline" />
      </div>

      <p className={`ig-note${on(8)}`}>
        <b>Every comment gets an answer.</b> A fix when it is worth one, a reason when it is not.
      </p>
    </div>
  );
};

export const Integrations = () => (
  <section className="block alt" id="integrations" aria-labelledby="h2-integrations">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-integrations">
          The cards write themselves
        </h2>
        <p className="sub rv" style={delay(40)}>
          Most tasks start somewhere else, in an issue or a crash report. <b>One click</b> makes it
          a card with the goal already written for you, and whatever those tools send back lands in
          one inbox.
        </p>
      </div>

      <ul className="ig-strip rv" style={delay(30)} aria-label="Connected tools">
        {CARDS.map((card, index) => (
          <li
            key={card.brand}
            className="ig-chip"
            style={{ ...delay(30 + index * 20), '--brand': BRAND_COLOR[card.brand] } as CSSProperties}
          >
            <BrandMark brand={card.brand} size={16} />
            <span>{card.name}</span>
          </li>
        ))}
      </ul>

      <h3 className="rv" id="h3-resolve" style={delay(80)}>
        From a review comment to a commit
      </h3>

      <div className="ig-resolve rv" style={delay(100)}>
        <IntegrationsFlow />
      </div>

      <p className="caption rv" style={delay(120)}>
        You stay in the app and the thread stays answered.
      </p>

      <a
        className="more rv"
        style={delay(140)}
        href={`${SITE.concepts}#integration-surface`}
      >
        See where each integration stands <span className="arr">→</span>
      </a>
    </div>
  </section>
);
