import type { StudioPlace } from '../../../../store/slices/navigation/studio';

export type GuideTarget =
  | { readonly kind: 'studio'; readonly studio: StudioPlace }
  | { readonly kind: 'board' }
  | { readonly kind: 'newSession' }
  | { readonly kind: 'palette' };

export type GuideLink = {
  readonly label: string;
  readonly target: GuideTarget;
};
