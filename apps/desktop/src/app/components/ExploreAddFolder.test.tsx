// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { SESSION, sessionFixture } from '../../__tests__/helpers/actionFixtures';
import { ExploreAddFolder } from './ExploreAddFolder';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ExploreAddFolder', () => {
  it('offers Add folder for the workspace of the session', () => {
    useAppStore.setState({ sessions: [sessionFixture()] });
    render(<ExploreAddFolder sessionId={SESSION} />);

    expect(screen.getByRole('button', { name: 'Add folder' })).toBeDefined();
  });

  it('draws nothing for a session it cannot find', () => {
    useAppStore.setState({ sessions: [] });
    const { container } = render(<ExploreAddFolder sessionId={SESSION} />);

    expect(container.firstChild).toBeNull();
  });
});
