// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { apcaContrast } from '../../test/apcaContrast';
import { oklchToSrgb, type Rgb } from '../../test/colorMath';
import { contrastRatio, scaleStepOf, THEME_NAMES, type Theme } from '../../test/styleTokens';

const TEXT_FLOOR = 4.5;
const CONTENT_LC = 60;
const LABEL_LC = 45;
const STEP_COUNT = 12;
const BACKGROUND_STEPS = [1, 2, 3] as const;
const TONE_SCALES = ['blue', 'green', 'amber', 'red', 'purple', 'cyan'] as const;
const SCALES = ['gray', ...TONE_SCALES] as const;

const WHITE_INK = oklchToSrgb(0.995, 0, 0);
const AMBER_INK: Readonly<Record<Theme, Rgb>> = {
  dark: oklchToSrgb(0.2, 0.04, 62),
  light: oklchToSrgb(0.15, 0.03, 62),
};

type Pair = {
  readonly label: string;
  readonly text: Rgb;
  readonly background: Rgb;
  readonly lc: number;
};

type StepPairsParams = {
  readonly theme: Theme;
  readonly scale: string;
  readonly step: number;
  readonly on: string;
  readonly lc: number;
};

const stepPairs = ({ theme, scale, step, on, lc }: StepPairsParams): ReadonlyArray<Pair> =>
  BACKGROUND_STEPS.map((background) => ({
    label: `${theme} ${scale}-${step} on ${on}-${background}`,
    text: scaleStepOf({ theme, scale, step }),
    background: scaleStepOf({ theme, scale: on, step: background }),
    lc,
  }));

type ToneParams = { readonly theme: Theme; readonly scale: string };

const inkOf = ({ theme, scale }: ToneParams): Rgb =>
  scale === 'amber' ? AMBER_INK[theme] : WHITE_INK;

const solidPairs = ({ theme, scale }: ToneParams): ReadonlyArray<Pair> =>
  [9, 10].map((step) => ({
    label: `${theme} ink on ${scale}-${step}`,
    text: inkOf({ theme, scale }),
    background: scaleStepOf({ theme, scale, step }),
    lc: LABEL_LC,
  }));

const tonePairs = ({ theme, scale }: ToneParams): ReadonlyArray<Pair> => [
  ...stepPairs({ theme, scale, step: 12, on: scale, lc: CONTENT_LC }),
  ...stepPairs({ theme, scale, step: 11, on: scale, lc: LABEL_LC }),
  ...stepPairs({ theme, scale, step: 11, on: 'gray', lc: LABEL_LC }),
  ...solidPairs({ theme, scale }),
];

const PAIRS: ReadonlyArray<Pair> = THEME_NAMES.flatMap((theme) => [
  ...stepPairs({ theme, scale: 'gray', step: 12, on: 'gray', lc: CONTENT_LC }),
  ...stepPairs({ theme, scale: 'gray', step: 11, on: 'gray', lc: CONTENT_LC }),
  ...stepPairs({ theme, scale: 'gray', step: 10, on: 'gray', lc: LABEL_LC }),
  ...TONE_SCALES.flatMap((scale) => tonePairs({ theme, scale })),
]);

type OnScreenParams = { readonly rgb: Rgb };

const onScreen = ({ rgb }: OnScreenParams): Rgb => [
  Math.round(rgb[0] * 255) / 255,
  Math.round(rgb[1] * 255) / 255,
  Math.round(rgb[2] * 255) / 255,
];

const STEPS = Array.from({ length: STEP_COUNT }, (_, index) => index + 1);

describe('the raw palette scales', () => {
  it.each(THEME_NAMES.flatMap((theme) => SCALES.map((scale) => ({ theme, scale }))))(
    'define twelve opaque steps for $scale in $theme',
    ({ theme, scale }) => {
      expect(STEPS.map((step) => scaleStepOf({ theme, scale, step }))).toHaveLength(STEP_COUNT);
    },
  );

  it.each(PAIRS)('$label clears 4.5:1 and its APCA floor', ({ text, background, lc }) => {
    const screenText = onScreen({ rgb: text });
    const screenBackground = onScreen({ rgb: background });
    const apca = apcaContrast({ text: screenText, background: screenBackground });

    expect(contrastRatio({ first: screenText, second: screenBackground })).toBeGreaterThanOrEqual(
      TEXT_FLOOR,
    );
    expect(Math.round(Math.abs(apca))).toBeGreaterThanOrEqual(lc);
  });
});
