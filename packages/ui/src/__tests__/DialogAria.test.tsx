// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Dialog } from '../components/Dialog';

afterEach(cleanup);

describe('Dialog accessible name and description', () => {
  it('is named by its title', () => {
    render(
      <Dialog open onClose={() => undefined} title="Add workspace">
        <p>content</p>
      </Dialog>,
    );

    screen.getByRole('dialog', { name: 'Add workspace' });
  });

  it('is described by its description', () => {
    render(
      <Dialog open onClose={() => undefined} title="Add workspace" description="Pick a folder">
        <p>content</p>
      </Dialog>,
    );

    screen.getByRole('dialog', { name: 'Add workspace', description: 'Pick a folder' });
  });

  it('has no name when there is no title', () => {
    render(
      <Dialog open onClose={() => undefined} showClose={false}>
        <p>content</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBeNull();
  });

  it('has no description when there is none', () => {
    render(
      <Dialog open onClose={() => undefined} title="Only a title">
        <p>content</p>
      </Dialog>,
    );

    expect(
      screen.getByRole('dialog', { name: 'Only a title' }).getAttribute('aria-describedby'),
    ).toBeNull();
  });
});
