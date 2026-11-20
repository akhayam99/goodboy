// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Input } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ReplyTemplateField } from './ReplyTemplateField';
import { SettingRow } from './SettingRow';

const failedSave = {
  error: 'The settings file is read only.',
  isSaving: false,
  retry: vi.fn(async () => undefined),
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const describedText = (control: HTMLElement): string =>
  (control.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe('a failed setting save is linked to its field', () => {
  it('describes the reply template with the save error and marks it invalid', () => {
    render(
      <ReplyTemplateField
        label="Reply template"
        rowKey="reply-template"
        draft="Fixed in {sha}"
        isDisabled={false}
        save={failedSave}
        onDraftChange={() => undefined}
        onCommit={() => undefined}
      />,
    );

    const field = screen.getByRole('textbox', { name: 'Reply template' });
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(field)).toContain('The settings file is read only.');
  });

  it('describes the control of a setting row with the save error and marks it invalid', () => {
    render(
      <SettingRow label="Branch prefix" save={failedSave}>
        <Input value="goodboy/" onChange={() => undefined} />
      </SettingRow>,
    );

    const field = screen.getByRole('textbox', { name: 'Branch prefix' });
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(field)).toContain('The settings file is read only.');
  });
});
