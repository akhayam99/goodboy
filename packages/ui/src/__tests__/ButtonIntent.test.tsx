// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BUTTON_INTENT_CLASSES, Button } from '../components/Button';

describe('Button intent', () => {
  afterEach(cleanup);

  it('keeps the default look without an intent', () => {
    render(<Button>Push</Button>);
    expect(screen.getByRole('button').className).toContain('bg-primary');
    expect(screen.getByRole('button').hasAttribute('data-intent')).toBe(false);
  });

  it('draws caution and destructive as an outline on secondary', () => {
    render(
      <>
        <Button variant="secondary" intent="caution">
          Rebase
        </Button>
        <Button variant="secondary" intent="destructive">
          Remove
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Rebase' }).className).toContain(
      BUTTON_INTENT_CLASSES.caution.outline,
    );
    expect(screen.getByRole('button', { name: 'Remove' }).className).toContain(
      BUTTON_INTENT_CLASSES.destructive.outline,
    );
  });

  it('fills a tone only on the primary variant', () => {
    render(
      <Button variant="primary" intent="destructive">
        Remove worktree
      </Button>,
    );
    expect(screen.getByRole('button').className).toContain(
      BUTTON_INTENT_CLASSES.destructive.filled,
    );
  });

  it('draws a quiet tone on quiet', () => {
    render(
      <Button variant="quiet" intent="caution">
        Rebase
      </Button>,
    );
    expect(screen.getByRole('button').className).toContain(BUTTON_INTENT_CLASSES.caution.quiet);
  });

  it('leaves neutral and primary intents on the base variant', () => {
    render(
      <Button variant="secondary" intent="neutral">
        Open
      </Button>,
    );
    expect(screen.getByRole('button').className).toContain('bg-fill');
  });
});
