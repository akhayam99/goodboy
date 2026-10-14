import { describe, expect, it } from 'vitest';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';
import { isAutoStartEnabled } from './isAutoStartEnabled';

type RawParams = {
  readonly raw?: string;
  readonly isReleased: boolean;
};

const read = ({ raw, isReleased }: RawParams): boolean =>
  isAutoStartEnabled({
    settings: raw === undefined ? {} : { [SETTING_AUTO_EXPERIMENT]: raw },
    isReleased,
  });

describe('isAutoStartEnabled', () => {
  it('is on only for the exact string true once the release gate is open', () => {
    expect(read({ raw: 'true', isReleased: true })).toBe(true);
    expect(read({ isReleased: true })).toBe(false);
    expect(read({ raw: 'false', isReleased: true })).toBe(false);
    expect(read({ raw: '', isReleased: true })).toBe(false);
    expect(read({ raw: 'TRUE', isReleased: true })).toBe(false);
    expect(read({ raw: '1', isReleased: true })).toBe(false);
  });

  it('stays off while the release gate is closed, whatever the setting says', () => {
    expect(read({ raw: 'true', isReleased: false })).toBe(false);
  });

  it('reads the closed gate of the build by default', () => {
    expect(isAutoStartEnabled({ settings: { [SETTING_AUTO_EXPERIMENT]: 'true' } })).toBe(false);
  });
});
