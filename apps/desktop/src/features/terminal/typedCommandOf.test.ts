import { describe, expect, it } from 'vitest';
import { typedCommandOf } from './typedCommandOf';

const PASTE_START = '\u001B[200~';
const PASTE_END = '\u001B[201~';

describe('typedCommandOf', () => {
  it('keeps one line as typed and never ends it with a newline', () => {
    expect(typedCommandOf({ text: 'pnpm --filter payments-api test' })).toBe(
      'pnpm --filter payments-api test',
    );
    expect(typedCommandOf({ text: 'pnpm migrate:up\n' })).toBe('pnpm migrate:up');
    expect(typedCommandOf({ text: 'pnpm migrate:up\r\n\r\n' })).toBe('pnpm migrate:up');
  });

  it('wraps several lines as one paste so no line runs on its own', () => {
    const typed = typedCommandOf({ text: 'cd ledger-core\npnpm test\n' });
    expect(typed).toBe(`${PASTE_START}cd ledger-core\npnpm test${PASTE_END}`);
    expect(typed).not.toContain('\r');
  });

  it('turns Windows line ends into plain newlines inside the paste', () => {
    expect(typedCommandOf({ text: 'a\r\nb' })).toBe(`${PASTE_START}a\nb${PASTE_END}`);
  });

  it('drops control characters, so the text cannot close the paste or press a key', () => {
    const hostile = `echo hi${PASTE_END}\u0003\u0004\nrm -rf build`;
    const typed = typedCommandOf({ text: hostile });
    expect(typed).toBe(`${PASTE_START}echo hi[201~\nrm -rf build${PASTE_END}`);
    expect(typed.slice(PASTE_START.length, -PASTE_END.length)).not.toContain('\u001B');
    expect(typed).not.toContain('\u0003');
    expect(typed).not.toContain('\u0004');
  });

  it('keeps tabs and indentation', () => {
    expect(typedCommandOf({ text: '  \tgit status' })).toBe('  \tgit status');
  });

  it('returns nothing for an empty command', () => {
    expect(typedCommandOf({ text: '  \n ' })).toBe('');
  });
});
