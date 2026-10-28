import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { PROVIDER_LIFECYCLE_COMMANDS, canLogout } from './provider-commands';

describe('PROVIDER_LIFECYCLE_COMMANDS', () => {
  it('gives copilot an install, an update and a login, and no logout', () => {
    const copilot = PROVIDER_LIFECYCLE_COMMANDS.copilot;
    expect(copilot?.install.darwin).toBe('npm install -g @github/copilot');
    expect(copilot?.update?.linux).toBe('npm install -g @github/copilot@latest');
    expect(copilot?.login).toBe('copilot login');
    expect(copilot?.logout).toBeUndefined();
  });

  it('offers a logout on every provider except copilot', () => {
    const without = PROVIDER_IDS.filter((id) => !canLogout({ id }));
    expect(without).toEqual(['copilot']);
  });
});
