// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { IntegrationBinding } from '@goodboy/types';
import {
  bindingIdOf,
  credentialIdOf,
  isoDateTimeOf,
  workspaceIdOf,
} from '../../../__tests__/helpers/brandedIds';
import { requestCredentialRecheck } from '../credentials';
import { useToolSecrets } from '.';

const answers = vi.hoisted(() => {
  const calls: Array<string> = [];
  return { pending: new Map<string, (hasSecret: boolean) => void>(), calls };
});

vi.mock('../credentials', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../credentials')>()),
  integrationCredentialHasSecret: ({ credentialId }: { readonly credentialId: string }) =>
    new Promise<boolean>((resolve) => {
      answers.calls.push(credentialId);
      answers.pending.set(credentialId, resolve);
    }),
}));

afterEach(() => {
  cleanup();
  answers.pending.clear();
  answers.calls.length = 0;
});

const bindingOf = ({ id, credential }: { readonly id: string; readonly credential: string }) => {
  const binding: IntegrationBinding = {
    id: bindingIdOf({ value: id }),
    workspaceId: workspaceIdOf({ value: 'workspace-1' }),
    projectId: null,
    credentialId: credentialIdOf({ value: credential }),
    createdAt: isoDateTimeOf({ value: '2026-09-01' }),
    updatedAt: isoDateTimeOf({ value: '2026-09-01' }),
    provider: 'linear',
    config: { viewerName: 'Mara Quint', viewerUserId: 'mara', workspaceUrlKey: 'harborline' },
  };
  return binding;
};

describe('useToolSecrets', () => {
  it('keys the keychain answer by binding id', async () => {
    const linear = bindingOf({ id: 'binding-1', credential: 'credential-1' });
    const { result } = renderHook(() => useToolSecrets({ integrations: [linear], checkedAtMs: 0 }));

    await act(async () => {
      answers.pending.get('credential-1')?.(false);
    });

    await waitFor(() => expect(result.current[linear.id]).toBe('missing'));
  });

  it('drops the answer for a binding that was replaced before the keychain replied', async () => {
    const first = bindingOf({ id: 'binding-1', credential: 'credential-1' });
    const second = bindingOf({ id: 'binding-2', credential: 'credential-2' });
    const { result, rerender } = renderHook(
      ({ integrations }) => useToolSecrets({ integrations, checkedAtMs: 0 }),
      { initialProps: { integrations: [first] } },
    );

    rerender({ integrations: [second] });
    await act(async () => {
      answers.pending.get('credential-1')?.(false);
      answers.pending.get('credential-2')?.(true);
    });

    await waitFor(() => expect(result.current[second.id]).toBe('present'));
    expect(result.current[first.id]).toBeUndefined();
  });

  it('reads the keychain again when a recheck is requested', async () => {
    const linear = bindingOf({ id: 'binding-1', credential: 'credential-1' });
    const { result } = renderHook(() => useToolSecrets({ integrations: [linear], checkedAtMs: 0 }));
    await act(async () => {
      answers.pending.get('credential-1')?.(true);
    });
    await waitFor(() => expect(result.current[linear.id]).toBe('present'));

    act(() => requestCredentialRecheck());
    await act(async () => {
      answers.pending.get('credential-1')?.(false);
    });

    await waitFor(() => expect(result.current[linear.id]).toBe('missing'));
    expect(answers.calls).toEqual(['credential-1', 'credential-1']);
  });
});
