import './Providers.css';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type Chip = {
  readonly brand: BrandId;
  readonly name: string;
  readonly plan: string;
};

const PROVIDER_CHIPS: readonly Chip[] = [
  { brand: 'anthropic', name: 'Claude', plan: 'Claude Max or Pro' },
  { brand: 'codex', name: 'Codex', plan: 'ChatGPT Plus or Pro' },
  { brand: 'cursor', name: 'Cursor', plan: 'Cursor Pro' },
  { brand: 'gemini', name: 'Gemini', plan: 'Antigravity, from Google' },
  { brand: 'opencode', name: 'OpenCode', plan: 'free models, no key needed' },
  { brand: 'openrouter', name: 'OpenRouter', plan: 'many models, one place' },
  { brand: 'moonshot', name: 'Moonshot', plan: 'Kimi, from Moonshot' },
];

const TOOL_CHIPS: readonly Chip[] = [
  { brand: 'github', name: 'GitHub', plan: 'Issues & pull requests' },
  { brand: 'gitlab', name: 'GitLab', plan: 'Issues & merge requests' },
  { brand: 'bitbucket', name: 'Bitbucket', plan: 'Pull requests' },
  { brand: 'linear', name: 'Linear', plan: 'Issues' },
  { brand: 'jira', name: 'Jira', plan: 'Issues' },
  { brand: 'sentry', name: 'Sentry', plan: 'Crash reports, read-only' },
  { brand: 'slack', name: 'Slack', plan: 'Notifications' },
];

const BELT_COPIES = 4;

const BeltChip = ({ chip }: { chip: Chip }) => (
  <div className="bchip">
    <BrandMark brand={chip.brand} size={20} />
    <span>
      <span className="bname">{chip.name}</span>
      <br />
      <span className="bplan">{chip.plan}</span>
    </span>
  </div>
);

const BeltCopy = ({ chips }: { chips: readonly Chip[] }) => (
  <>
    {chips.map((chip) => (
      <BeltChip chip={chip} key={chip.brand} />
    ))}
  </>
);

const renderBelt = (chips: readonly Chip[]) => (
  <>
    <BeltCopy chips={chips} />
    {Array.from({ length: BELT_COPIES - 1 }, (_, copyIndex) => (
      <div className="pv-loop" aria-hidden="true" key={`loop-${copyIndex}`}>
        <BeltCopy chips={chips} />
      </div>
    ))}
  </>
);

export const Providers = () => (
  <section id="providers" aria-label="Providers">
    <p className="beltEyebrow rv">Runs on the plans you already pay for</p>
    <p className="vh">Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter and Moonshot.</p>
    <div className="belt rv" style={delay(80)} aria-hidden="true">
      <div className="beltTrack">{renderBelt(PROVIDER_CHIPS)}</div>
    </div>
    <p className="beltMore rv" style={delay(140)}>
      Seven providers, one session. Your logins stay where they already are.{' '}
      <a href={SITE.providersDoc}>Set up a provider →</a>
    </p>

    <p className="beltEyebrow rv" style={{ ...delay(160), marginTop: 36 }}>
      Works with the tools you already use
    </p>
    <p className="vh">GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack.</p>
    <div className="belt rv" style={delay(180)} aria-hidden="true">
      <div className="beltTrack beltTrackReverse">{renderBelt(TOOL_CHIPS)}</div>
    </div>
  </section>
);
