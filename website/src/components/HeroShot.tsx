import './HeroShot.css';
import { MockStage } from './mocks/MockStage';

const WIDTH = 1208;
const HEIGHT = 529;
const DENSITIES = [1, 2, 3];
const SIZES =
  '(max-width: 600px) calc(100vw - 82px), (max-width: 1320px) calc(100vw - 114px), 1208px';
const ALT =
  'Goodboy with the Harborline session Stop retried webhooks posting a second credit open on its Overview. The Folders card lists payments-api and notify-relay with their branches, one unfolded to its pull request, comments, files and checks. The Activity timeline interleaves three runs on Claude, Codex and Cursor models, and the shared Context drawer shows the decisions that changed.';

type Theme = 'dark' | 'light';

type SourceParams = {
  readonly theme: Theme;
};

const srcSetOf = ({ theme }: SourceParams): string =>
  DENSITIES.map(
    (density) => `/hero/hero-${theme}-${WIDTH * density}.webp ${WIDTH * density}w`,
  ).join(', ');

const THEMES: ReadonlyArray<Theme> = ['dark', 'light'];

export const HeroShot = () => (
  <MockStage className="heroShot" label="Goodboy, the app" isHero>
    {THEMES.map((theme) => (
      <img
        key={theme}
        className={`heroShotImage heroShot-${theme}`}
        src={`/hero/hero-${theme}-${WIDTH}.webp`}
        srcSet={srcSetOf({ theme })}
        sizes={SIZES}
        width={WIDTH}
        height={HEIGHT}
        alt={ALT}
        loading="lazy"
        decoding="async"
        data-hero-shot=""
      />
    ))}
  </MockStage>
);
