import { describe, expect, it } from 'vitest';
import type { BudgetAlert } from '@goodboy/types';
import {
  asEffortLevel,
  asProvider,
  CHAT_PREFIX_RE,
  dataUrlToBase64,
  extFromMime,
  readFileAsDataUrl,
  toAttachmentInput,
  toastKindForAlert,
  toastMessageForAlert,
  type PendingAttachment,
} from './lib';

const makeAlert = (over: Partial<BudgetAlert> = {}): BudgetAlert =>
  ({
    id: 'al_1',
    kind: 'session-threshold',
    currentUsd: 5,
    capUsd: 10,
    createdAt: '2026-05-15T00:00:00.000Z',
    ...over,
  }) as BudgetAlert;

describe('extFromMime', () => {
  it('extracts the subtype as the extension', () => {
    expect(extFromMime('image/png')).toBe('png');
    expect(extFromMime('image/jpeg')).toBe('jpeg');
  });

  it('falls back to "png" when there is no subtype', () => {
    expect(extFromMime('image/')).toBe('png');
  });

  it('falls back to "png" when there is no slash', () => {
    expect(extFromMime('png')).toBe('png');
  });

  it('falls back to "png" for an over-long subtype', () => {
    expect(extFromMime('application/octet-stream')).toBe('png');
  });
});

describe('dataUrlToBase64', () => {
  it('strips the data url header', () => {
    expect(dataUrlToBase64('data:image/png;base64,AAAB')).toBe('AAAB');
  });

  it('returns the input when there is no comma', () => {
    expect(dataUrlToBase64('AAAB')).toBe('AAAB');
  });
});

describe('toAttachmentInput', () => {
  it('maps a pending attachment to provider input with decoded base64', () => {
    const pending: PendingAttachment = {
      id: 'att_1',
      fileName: 'shot.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAB',
      relPath: null,
    };
    expect(toAttachmentInput(pending)).toEqual({
      id: 'att_1',
      fileName: 'shot.png',
      mimeType: 'image/png',
      dataBase64: 'AAAB',
    });
  });
});

describe('asEffortLevel', () => {
  it('accepts a valid effort level', () => {
    expect(asEffortLevel('high')).toBe('high');
  });

  it('rejects an unknown value', () => {
    expect(asEffortLevel('bogus')).toBeNull();
  });

  it('rejects null and empty input', () => {
    expect(asEffortLevel(null)).toBeNull();
    expect(asEffortLevel('')).toBeNull();
  });
});

describe('asProvider', () => {
  it('accepts a valid provider', () => {
    expect(asProvider('anthropic')).toBe('anthropic');
  });

  it('rejects a provider not in the allow list', () => {
    expect(asProvider('openai')).toBeNull();
  });

  it('rejects null input', () => {
    expect(asProvider(null)).toBeNull();
  });
});

describe('toastKindForAlert', () => {
  it('maps exceeded alerts to errors', () => {
    expect(toastKindForAlert('provider-exceeded')).toBe('error');
    expect(toastKindForAlert('session-exceeded')).toBe('error');
  });

  it('maps threshold alerts to warnings', () => {
    expect(toastKindForAlert('provider-threshold')).toBe('warning');
    expect(toastKindForAlert('session-threshold')).toBe('warning');
  });
});

describe('toastMessageForAlert', () => {
  it('reports a provider threshold percentage', () => {
    const alert = makeAlert({
      kind: 'provider-threshold',
      provider: 'cursor',
      currentUsd: 5,
      capUsd: 10,
    });
    expect(toastMessageForAlert(alert)).toBe('provider cursor budget at 50%');
  });

  it('reports 0% when the cap is zero', () => {
    const alert = makeAlert({
      kind: 'provider-threshold',
      provider: 'cursor',
      currentUsd: 5,
      capUsd: 0,
    });
    expect(toastMessageForAlert(alert)).toBe('provider cursor budget at 0%');
  });

  it('reports a provider exceeded message', () => {
    const alert = makeAlert({ kind: 'provider-exceeded', provider: 'codex' });
    expect(toastMessageForAlert(alert)).toBe('provider codex budget exceeded');
  });

  it('falls back to "?" for a missing provider', () => {
    const alert = makeAlert({ kind: 'provider-exceeded', provider: undefined });
    expect(toastMessageForAlert(alert)).toBe('provider ? budget exceeded');
  });

  it('reports a session threshold percentage', () => {
    const alert = makeAlert({ kind: 'session-threshold', currentUsd: 9, capUsd: 10 });
    expect(toastMessageForAlert(alert)).toBe('session budget at 90%');
  });

  it('reports a session exceeded message', () => {
    const alert = makeAlert({ kind: 'session-exceeded' });
    expect(toastMessageForAlert(alert)).toBe('session budget exceeded');
  });
});

describe('CHAT_PREFIX_RE', () => {
  it('matches single-token command prefixes', () => {
    expect(CHAT_PREFIX_RE.test('$build')).toBe(true);
    expect(CHAT_PREFIX_RE.test('~workflow')).toBe(true);
    expect(CHAT_PREFIX_RE.test('@agent')).toBe(true);
    expect(CHAT_PREFIX_RE.test('/cmd')).toBe(true);
  });

  it('tolerates leading whitespace', () => {
    expect(CHAT_PREFIX_RE.test('  $build')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(CHAT_PREFIX_RE.test('hello')).toBe(false);
  });

  it('rejects a prefix followed by a space and more text', () => {
    expect(CHAT_PREFIX_RE.test('$build now')).toBe(false);
  });
});

describe('readFileAsDataUrl', () => {
  it('reads a file into a data url string', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const result = await readFileAsDataUrl(file);
    expect(result.startsWith('data:')).toBe(true);
  });
});
