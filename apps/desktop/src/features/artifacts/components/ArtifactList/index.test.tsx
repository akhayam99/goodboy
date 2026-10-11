// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, picker } = vi.hoisted(() => ({
  state: {
    sessionArtifacts: { 'session-1': [] } as Record<string, ReadonlyArray<unknown>>,
    artifactLoadErrors: {} as Record<string, string | null>,
    loadSessionArtifacts: vi.fn(async () => undefined),
    openArtifactCreation: vi.fn(),
    importWireframe: vi.fn(async (_params: Record<string, unknown>) => ({ id: 'wireframe-9' })),
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    workspaces: [] as ReadonlyArray<Record<string, unknown>>,
  },
  picker: { next: null as unknown },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../wireframes/readWireframeFile', () => ({
  pickWireframeFile: vi.fn(async () => picker.next),
  readWireframeFile: vi.fn(async () => picker.next),
}));

import { ArtifactList } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const renderList = (onImported = vi.fn()) => {
  render(
    <ArtifactList
      sessionId={SESSION_ID}
      rows={[]}
      counts={{ all: 0, plan: 0, report: 0, wireframe: 0 }}
      filter="all"
      onFilterChange={vi.fn()}
      onOpen={vi.fn()}
      onImported={onImported}
    />,
  );
  return onImported;
};

describe('ArtifactList states', () => {
  beforeEach(() => {
    state.sessionArtifacts = { 'session-1': [] };
    state.artifactLoadErrors = {};
  });

  it('shows loading rows before an initial read and never the empty state', () => {
    state.sessionArtifacts = {};
    renderList();
    screen.getByRole('heading', { name: 'Artifacts' });
    expect(screen.getAllByRole('status', { name: 'Loading artifacts' })).toHaveLength(3);
    expect(screen.queryByText('No artifacts yet')).toBeNull();
  });

  it('offers Retry and Details after a failed initial read', () => {
    state.sessionArtifacts = {};
    state.artifactLoadErrors = { 'session-1': 'The artifact read failed' };
    renderList();
    screen.getByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.loadSessionArtifacts).toHaveBeenCalledWith('session-1');
    screen.getByRole('button', { name: 'Details' });
    expect(screen.queryByText('No artifacts yet')).toBeNull();
  });
  it('says what will be here and offers one primary the first time', async () => {
    renderList();

    expect(screen.getByRole('heading', { level: 2, name: 'No artifacts yet' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'New artifact' }));

    expect(await screen.findByRole('menu', { name: 'New artifact' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Report/ })).toBeDefined();
  });

  it('names the filter and clears it when the filter matches nothing', () => {
    const onFilterChange = vi.fn();
    render(
      <ArtifactList
        sessionId={SESSION_ID}
        rows={[]}
        counts={{ all: 3, plan: 0, report: 2, wireframe: 1 }}
        filter="plan"
        onFilterChange={onFilterChange}
        onOpen={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'No artifacts yet' })).toBeNull();
    expect(screen.getByText('No plans in this session.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(onFilterChange).toHaveBeenCalledWith('all');
  });
});

describe('ArtifactList header row', () => {
  it('holds the tab strip, New and Show in Finder at one 28px control height', () => {
    renderList();

    const tabs = screen.getByRole('tablist', { name: 'Artifact kind' });
    const create = screen.getByTestId('artifact-new');
    const folder = screen.getByRole('button', { name: 'Show in Finder' });
    expect(tabs.getAttribute('data-size')).toBe('xs');
    expect(create.getAttribute('data-size')).toBe('sm');
    expect(folder.getAttribute('data-size')).toBe('sm');
    const actions = create.closest('[class*="ml-auto"]');
    expect(actions).not.toBeNull();
    expect(actions?.contains(folder)).toBe(true);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(actions?.contains(tabs)).toBe(false);
  });
});

const openImport = () => {
  fireEvent.click(screen.getByTestId('artifact-new'));
  fireEvent.click(screen.getByRole('menuitem', { name: /Import wireframe JSON/ }));
};

beforeEach(() => {
  state.importWireframe.mockClear();
  picker.next = null;
});
afterEach(cleanup);

describe('ArtifactList wireframe import', () => {
  it('says what the validator adjusted and imports on Import anyway', async () => {
    picker.next = {
      status: 'ready',
      fileName: 'cascadia-onboarding.json',
      title: 'Cascadia onboarding',
      sourceText: '{"version":2}',
      fidelity: 'low',
      screenCount: 4,
      device: 'phone',
      version: 2,
      adjustments: ['screens[0].root.width is not part of the wireframe contract'],
    };
    const onImported = renderList();
    openImport();
    await waitFor(() =>
      expect(
        screen.getByText('Cascadia onboarding can be imported with 1 adjustment.'),
      ).toBeDefined(),
    );
    expect(screen.getByTestId('wireframe-import-preview').textContent).toContain(
      '4 screens · phone · version 2',
    );
    fireEvent.click(screen.getByTestId('wireframe-import-confirm'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('wireframe-9'));
    expect(state.importWireframe).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cascadia onboarding', sourceText: '{"version":2}' }),
    );
    expect(screen.queryByTestId('wireframe-import-preview')).toBeNull();
  });

  it('refuses a file it cannot read and imports nothing', async () => {
    picker.next = {
      status: 'invalid',
      fileName: 'notes.json',
      issues: [{ path: 'screens', message: 'expected at least one screen' }],
    };
    renderList();
    openImport();
    await waitFor(() =>
      expect(screen.getByText('notes.json is not a wireframe Goodboy can read.')).toBeDefined(),
    );
    expect(screen.getByTestId('wireframe-import-issues').textContent).toContain(
      'screens: expected at least one screen',
    );
    expect(state.importWireframe).not.toHaveBeenCalled();
  });
});
