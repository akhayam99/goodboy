// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { getVersion } = vi.hoisted(() => ({ getVersion: vi.fn(async () => '0.0.1') }));

vi.mock('@tauri-apps/api/app', () => ({ getVersion }));

import { useInstalledVersion } from './index';

const PACKAGE_JSON = join(__dirname, '..', '..', '..', '..', '..', 'package.json');

const packageVersion = (): string => {
  const parsed: unknown = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error('apps/desktop/package.json has no version');
  }
  return String(parsed.version);
};

describe('useInstalledVersion', () => {
  it('reads the version the build stamped from package.json on the first render', () => {
    const { result } = renderHook(() => useInstalledVersion());

    expect(result.current).toBe(packageVersion());
    expect(getVersion).not.toHaveBeenCalled();
  });
});
