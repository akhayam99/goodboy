import type { Tone } from './tint';

type Params = {
  readonly tone: Tone;
};

const SELECTED_ICON: Readonly<Record<Tone, string>> = {
  success: '[&>svg:first-child]:text-success',
  info: '[&>svg:first-child]:text-info',
  warning: '[&>svg:first-child]:text-warning',
  danger: '[&>svg:first-child]:text-danger',
  primary: '[&>svg:first-child]:text-primary',
  merged: '[&>svg:first-child]:text-merged',
  draft: '[&>svg:first-child]:text-draft',
  neutral: '[&>svg:first-child]:text-foreground',
};

export const selectedIconClass = ({ tone }: Params): string => SELECTED_ICON[tone];
