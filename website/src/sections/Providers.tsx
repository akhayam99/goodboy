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
  { brand: 'openrouter', name: 'OpenRouter', plan: 'one key, many models' },
  { brand: 'moonshot', name: 'Moonshot', plan: 'Kimi, on your own key' },
];

export const Providers = () => (
  <section id="providers" aria-label="Providers">
    <p className="beltEyebrow rv">Runs on the plans you already pay for</p>
    <p className="vh">
      Claude on Claude Max or Pro, Codex on ChatGPT Plus or Pro, Cursor on Cursor Pro, Gemini
      through Antigravity, OpenCode with free models and no key, OpenRouter and Moonshot on a key
      you keep in your system keychain.
    </p>
    <div className="belt rv" style={delay(80)} aria-hidden="true">
      <div className="beltTrack">
        {[...CHIPS, ...CHIPS].map((chip, i) => (
          <div className="bchip" key={`${chip.brand}-${i}`}>
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
    <p className="beltMore rv" style={delay(140)}>
      Seven providers, one session. Goodboy runs each one&rsquo;s official command-line tool, the
      same one you would type into a terminal, so your logins stay where they already are.{' '}
      <a href={SITE.providersDoc}>Set up a provider →</a>
    </p>
  </section>
);
