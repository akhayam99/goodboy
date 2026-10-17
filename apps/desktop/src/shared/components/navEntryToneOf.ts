import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from './conceptIcons';

type Params = {
  readonly icon: LucideIcon;
};

const FALLBACK: Tone = 'primary';

const CONCEPT_TONES: Readonly<Record<string, Tone>> = CONCEPT_TONE;

const TONE_BY_ICON: ReadonlyMap<LucideIcon, Tone> = Object.entries(CONCEPT_ICONS).reduce(
  (byIcon, [concept, icon]) => {
    const tone = CONCEPT_TONES[concept];
    if (tone === undefined || tone === 'neutral' || byIcon.has(icon)) {
      return byIcon;
    }
    return byIcon.set(icon, tone);
  },
  new Map<LucideIcon, Tone>(),
);

const NAV_TONE_BY_ICON: ReadonlyMap<LucideIcon, Tone> = new Map<LucideIcon, Tone>([
  [CONCEPT_ICONS.agents, 'info'],
  [CONCEPT_ICONS.auto, 'info'],
  [CONCEPT_ICONS.plans, 'merged'],
  [CONCEPT_ICONS.artifacts, 'merged'],
]);

export const navEntryToneOf = ({ icon }: Params): Tone =>
  NAV_TONE_BY_ICON.get(icon) ?? TONE_BY_ICON.get(icon) ?? FALLBACK;
