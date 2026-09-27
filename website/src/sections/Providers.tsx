import { BrandMark, type BrandId } from '../components/BrandIcons';
import { SeeHow } from '../components/SeeHow';
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

const BeltCopy = () => (
  <div className="beltCopy">
    {PROVIDER_CHIPS.map((chip) => (
      <span className="bchip" key={chip.brand}>
        <BrandMark brand={chip.brand} size={20} />
        <span>{chip.name}</span>
      </span>
    ))}
  </div>
);

export const Providers = () => (
  <section id="providers" aria-label="Providers">
    <p className="beltEyebrow">Runs on the providers you connect</p>
    <p className="vh">Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter and Moonshot.</p>
    <div className="belt" aria-hidden="true">
      <div className="beltTrack">
        <BeltCopy />
        <BeltCopy />
      </div>
    </div>
    <p className="beltMore">
      Seven providers, one session. Connect each the way it supports, with a login you already have
      or an API key. <a href={SITE.providersDoc}>Set up a provider →</a>
    </p>
    <p className="beltHow">
      <SeeHow anchor="provider-connection" />
    </p>
  </section>
);
