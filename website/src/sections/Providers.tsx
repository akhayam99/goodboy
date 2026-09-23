import type { CSSProperties } from 'react';
import { BRAND_COLOR, BrandMark, type BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type Chip = {
  readonly brand: BrandId;
  readonly name: string;
};

const PROVIDER_CHIPS: readonly Chip[] = [
  { brand: 'anthropic', name: 'Claude' },
  { brand: 'codex', name: 'Codex' },
  { brand: 'cursor', name: 'Cursor' },
  { brand: 'gemini', name: 'Gemini' },
  { brand: 'opencode', name: 'OpenCode' },
  { brand: 'openrouter', name: 'OpenRouter' },
  { brand: 'moonshot', name: 'Moonshot' },
];

const TOOL_CHIPS: readonly Chip[] = [
  { brand: 'github', name: 'GitHub' },
  { brand: 'gitlab', name: 'GitLab' },
  { brand: 'bitbucket', name: 'Bitbucket' },
  { brand: 'linear', name: 'Linear' },
  { brand: 'jira', name: 'Jira' },
  { brand: 'sentry', name: 'Sentry' },
  { brand: 'slack', name: 'Slack' },
];

const BeltChip = ({ chip }: { chip: Chip }) => (
  <div className="bchip" style={{ '--brand': BRAND_COLOR[chip.brand] } as CSSProperties}>
    <BrandMark brand={chip.brand} size={20} />
    <span className="bname">{chip.name}</span>
  </div>
);

const BeltCopy = ({ chips, clone }: { chips: readonly Chip[]; clone?: boolean }) => (
  <div className={clone ? 'beltCopy beltClone' : 'beltCopy'} aria-hidden={clone || undefined}>
    {chips.map((chip) => (
      <BeltChip chip={chip} key={chip.brand} />
    ))}
  </div>
);

const renderBelt = (chips: readonly Chip[]) => (
  <>
    <BeltCopy chips={chips} />
    <BeltCopy chips={chips} clone />
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
