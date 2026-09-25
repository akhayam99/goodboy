// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { WireframeArtifact } from '@goodboy/types';

const { openSpy, folderSpy } = vi.hoisted(() => ({
  openSpy: vi.fn(async (_options: unknown): Promise<string | null> => '/tmp/exports'),
  folderSpy: vi.fn(async (_args: unknown) => '/tmp/exports/2026-09-25-onboarding-flow-rame01'),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (options: unknown) => openSpy(options),
}));
vi.mock('@tauri-apps/api/app', () => ({
  getVersion: async () => '0.6.0',
}));
vi.mock('../../artifacts/artifactFile', () => ({
  exportArtifactFolder: (args: unknown) => folderSpy(args),
}));

import { FOLDER_BLOCKED_MESSAGE, useWireframeFolderExport } from './index';

const document = {
  version: 1,
  initialScreenId: 'sign-in',
  theme: { name: 'harborline' },
  screens: [
    {
      id: 'sign-in',
      title: 'Sign in',
      viewport: 'mobile',
      root: {
        id: 'sign-in-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'sign-in-heading', kind: 'text', text: 'Harborline' }],
      },
    },
  ],
  transitions: [],
};

const artifact = {
  id: 'frame01',
  sessionId: 'session-1',
  kind: 'wireframe',
  title: 'Onboarding flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(document),
  metadata: { fidelity: 'low', designProfile: {} },
  status: 'active',
  revision: 1,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
} as unknown as WireframeArtifact;

afterEach(cleanup);

describe('useWireframeFolderExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for a folder and writes the export into it', async () => {
    const { result } = renderHook(() => useWireframeFolderExport({ artifact }));
    await act(async () => {
      await result.current.exportFolder();
    });
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({ directory: true }));
    const args = folderSpy.mock.calls[0]?.[0] as {
      readonly parent: string;
      readonly folder: string;
      readonly files: ReadonlyArray<{ readonly path: string }>;
    };
    expect(args.parent).toBe('/tmp/exports');
    expect(args.folder).toBe('2026-09-25-onboarding-flow-rame01');
    expect(args.files.map((file) => file.path)).toContain('screens/sign-in.html');
    expect(result.current.status).toEqual({
      kind: 'saved',
      path: '/tmp/exports/2026-09-25-onboarding-flow-rame01',
    });
  });

  it('writes nothing when the folder picker is dismissed', async () => {
    openSpy.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWireframeFolderExport({ artifact }));
    await act(async () => {
      await result.current.exportFolder();
    });
    expect(folderSpy).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'cancelled' });
  });

  it('refuses a wireframe that does not validate, without opening the picker', async () => {
    const broken = { ...artifact, sourceText: '{"screens":[]}' } as unknown as WireframeArtifact;
    const { result } = renderHook(() => useWireframeFolderExport({ artifact: broken }));
    await act(async () => {
      await result.current.exportFolder();
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'failed', message: FOLDER_BLOCKED_MESSAGE });
  });

  it('surfaces a write failure', async () => {
    folderSpy.mockRejectedValueOnce(new Error('the destination folder does not exist'));
    const { result } = renderHook(() => useWireframeFolderExport({ artifact }));
    await act(async () => {
      await result.current.exportFolder();
    });
    expect(result.current.status).toEqual({
      kind: 'failed',
      message: 'the destination folder does not exist',
    });
  });
});
