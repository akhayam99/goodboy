import './Providers.css';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

type Chip = {
  readonly brand: BrandId;
  readonly name: string;
  readonly plan: string;
};

const CHIPS: readonly Chip[] = [
  { brand: 'anthropic', name: 'Claude', plan: 'Claude Max or Pro' },
  { brand: 'codex', name: 'Codex', plan: 'ChatGPT Plus or Pro' },
  { brand: 'cursor', name: 'Cursor', plan: 'Cursor Pro' },
  { brand: 'gemini', name: 'Gemini', plan: 'Antigravity, from Google' },
  { brand: 'opencode', name: 'OpenCode', plan: 'free models, no key needed' },
  { brand: 'openrouter', name: 'OpenRouter', plan: 'many models, one place' },
  { brand: 'moonshot', name: 'Moonshot', plan: 'Kimi, from Moonshot' },
];

export const Providers = () => (
  <section id="providers" aria-label="Providers">
    <p className="beltEyebrow rv">Runs on the plans you already pay for</p>
    <p className="vh">Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter and Moonshot.</p>
    <div className="belt rv" style={delay(80)} aria-hidden="true">
      <div className="beltTrack">
        {CHIPS.map((chip) => (
          <div className="bchip" key={chip.brand}>
            <BrandMark brand={chip.brand} size={20} />
            <span>
              <span className="bname">{chip.name}</span>
              <br />
              <span className="bplan">{chip.plan}</span>
            </span>
          </div>
        ))}
        <div className="pv-loop">
          {CHIPS.map((chip) => (
            <div className="bchip" key={chip.brand}>
              <BrandMark brand={chip.brand} size={20} />
              <span>
                <span className="bname">{chip.name}</span>
                <br />
                <span className="bplan">{chip.plan}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <p className="beltMore rv" style={delay(140)}>
      Seven providers, one session. Your logins stay where they already are.{' '}
      <a href={SITE.providersDoc}>Set up a provider →</a>
    </p>
  </section>
);
