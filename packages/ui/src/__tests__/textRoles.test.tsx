// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Chip } from '../components/Chip';
import { Eyebrow } from '../components/Eyebrow';
import { MetaRow } from '../components/MetaRow';
import { ICON_SIZE } from '../iconSize';
import { TEXT_ROLE } from '../textRoles';

afterEach(cleanup);

describe('ICON_SIZE', () => {
  it('is the four-rung ladder and nothing else', () => {
    expect(ICON_SIZE).toEqual({ mark: 10, row: 12, control: 14, hero: 18 });
  });
});

describe('TEXT_ROLE', () => {
  it('names one colour class per role', () => {
    expect(TEXT_ROLE).toEqual({
      label: 'text-foreground',
      secondary: 'text-muted-foreground',
      hint: 'text-faint-foreground',
      disabled: 'text-disabled-foreground',
    });
  });

  it('colours the MetaRow facts secondary and its separator hint', () => {
    const { container } = render(<MetaRow items={['3 steps', '2m']} />);

    expect(container.firstElementChild?.className).toContain(TEXT_ROLE.secondary);
    expect(container.querySelector('[aria-hidden="true"]')?.className).toBe(TEXT_ROLE.hint);
  });

  it('colours the Eyebrow secondary, and hint when muted', () => {
    render(
      <>
        <Eyebrow label="Plain" />
        <Eyebrow label="Quiet" muted />
      </>,
    );

    expect(screen.getByText('Plain').className).toContain(TEXT_ROLE.secondary);
    expect(screen.getByText('Quiet').className).toContain(TEXT_ROLE.hint);
    expect(screen.getByText('Quiet').className).not.toContain(TEXT_ROLE.secondary);
  });

  it('colours a neutral Chip secondary and leaves a toned Chip on its tint', () => {
    render(
      <>
        <Chip tone="neutral" label="Neutral" />
        <Chip tone="danger" label="Danger" />
      </>,
    );

    expect(screen.getByText('Neutral').className).toContain(TEXT_ROLE.secondary);
    expect(screen.getByText('Danger').className).not.toContain(TEXT_ROLE.secondary);
  });
});
