// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { GitLaterScene, type GitLaterState } from './GitLaterScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly state: GitLaterState;
};

const mount = ({ state }: MountParams) => render(<GitLaterScene theme="light" state={state} />);

const gitBand = async () => screen.findByRole('region', { name: 'Git repository' }, WAIT);

describe('the git later scenes', () => {
  it('none offers Track with git on a code folder', async () => {
    mount({ state: 'none' });

    const band = await gitBand();
    expect(within(band).getByText('No git yet')).toBeDefined();
    expect(within(band).getByRole('button', { name: 'Track with git' })).toBeDefined();
  });

  it('review lists the first commit with secrets left out', async () => {
    mount({ state: 'review' });

    const flow = await screen.findByRole('region', { name: 'Track acme-web with git' }, WAIT);
    expect(within(flow).getByText('214 files in the first commit')).toBeDefined();
    expect(within(flow).getByText('looks like secrets, always left out')).toBeDefined();
    expect(within(flow).getByRole('button', { name: 'Make the first commit' })).toBeDefined();
  });

  it('tracked offers Publish to GitHub for a repository on this Mac only', async () => {
    mount({ state: 'tracked' });

    const band = await gitBand();
    expect(within(band).getByText('Not published')).toBeDefined();
    expect(within(band).getByRole('button', { name: 'Publish to GitHub' })).toBeDefined();
  });

  it('detected says git was found outside, with a way back', async () => {
    mount({ state: 'detected' });

    const band = await gitBand();
    expect(within(band).getByText('acme-web is now a git repository.')).toBeDefined();
    expect(within(band).getByRole('button', { name: 'Keep editing in place' })).toBeDefined();
  });

  it('empty offers the first commit of a repository with nothing in it', async () => {
    mount({ state: 'empty' });

    const band = await gitBand();
    expect(within(band).getByText('No commits yet')).toBeDefined();
    expect(within(band).getByRole('button', { name: 'Make the first commit' })).toBeDefined();
  });
});
