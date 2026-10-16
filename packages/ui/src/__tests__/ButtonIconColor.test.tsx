// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GitBranch } from 'lucide-react';
import { BUTTON_VARIANT_CLASSES, Button, type ButtonVariant } from '../components/Button';
import { tintClasses, type Tone } from '../tint';

const ICON_FOLLOWS_TEXT = '[&_svg]:text-current';

const TEXT_TOKEN_BY_VARIANT = {
  primary: 'text-on-tone',
  danger: 'text-on-tone',
  'ghost-danger': 'text-danger',
} as const satisfies Partial<Record<ButtonVariant, string>>;

const TONED_VARIANTS = ['primary', 'danger', 'ghost-danger'] as const satisfies ReadonlyArray<
  keyof typeof TEXT_TOKEN_BY_VARIANT
>;

const SOLID_TONES = [
  'success',
  'info',
  'warning',
  'danger',
  'primary',
  'merged',
  'draft',
] as const satisfies ReadonlyArray<Tone>;

const classesOf = ({ value }: { value: string }): ReadonlyArray<string> => value.split(' ');

describe('Button icon color', () => {
  afterEach(cleanup);

  it.each(TONED_VARIANTS)('draws the %s icon in the label color, never its own tint', (variant) => {
    const classes = classesOf({ value: BUTTON_VARIANT_CLASSES[variant] });

    expect(classes).toContain(TEXT_TOKEN_BY_VARIANT[variant]);
    expect(classes).toContain(ICON_FOLLOWS_TEXT);
  });

  it.each(TONED_VARIANTS)('overrides a tinted icon passed into a %s button', (variant) => {
    render(
      <Button variant={variant}>
        <GitBranch aria-hidden className="text-info" />
        Rebase
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Rebase' });

    expect(classesOf({ value: button.className })).toContain(ICON_FOLLOWS_TEXT);
    expect(button.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });

  it.each(SOLID_TONES)('draws icons on the %s solid fill in the on-tone label color', (tone) => {
    const classes = classesOf({ value: tintClasses(tone).solid });

    expect(classes).toContain('text-on-tone');
    expect(classes).toContain(ICON_FOLLOWS_TEXT);
  });
});
