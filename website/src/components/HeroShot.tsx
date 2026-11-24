import './HeroShot.css';
import { MockStage } from '../mocks/MockStage';

const WIDTH = 1208;
const HEIGHT = 529;
const DENSITIES = [1, 2, 3];
const SIZES =
  '(max-width: 600px) calc(100vw - 82px), (max-width: 1320px) calc(100vw - 114px), 1208px';
const ALT =
  'Goodboy with the Harborline session Stop retried webhooks posting a second credit open on its Overview. The Projects card lists payments-api, where pull request 318 is ready to merge and overlaps HBL-415 while a load test branch runs, and notify-relay, where pull request 57 is in review. The Activity list shows runs on Codex, Claude and Cursor models. Beside it, the diff of postCredit.ts keys every credit on the processor event id.';

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
        decoding="async"
        fetchPriority="high"
        data-hero-shot=""
      />
    ))}
  </MockStage>
);
