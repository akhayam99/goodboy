import { describe, expect, it } from 'vitest';
import type { OverrideSettings } from '@goodboy/types';
import { overridesWithAttribution } from '../../__tests__/helpers/attributionOverrides';
import { REPLY_SETTINGS_DEFAULT, replySettingsOf } from './replySettings';

const layer = (patch: Partial<OverrideSettings>): OverrideSettings => ({
  ...overridesWithAttribution({ attributionFooter: null }),
  ...patch,
});

describe('replySettingsOf', () => {
  it('starts terse, signed, resolving on GitHub, with a new commit per fix', () => {
    expect(replySettingsOf({ layers: [] })).toEqual(REPLY_SETTINGS_DEFAULT);
  });

  it('takes each field from the closest layer that set it', () => {
    expect(
      replySettingsOf({
        layers: [
          layer({ replyVoice: 'formal' }),
          layer({
            replyVoice: 'friendly',
            resolveOnGithub: false,
            resolveCommitStyle: 'fixup',
            attributionFooter: false,
          }),
        ],
      }),
    ).toMatchObject({
      voice: 'formal',
      resolveOnGithub: false,
      commitStyle: 'fixup',
      isSigned: false,
    });
  });

  it('falls back to the default template when a layer saved a blank one', () => {
    expect(
      replySettingsOf({ layers: [layer({ replyTemplateFixed: '  ', replyStyleNote: '' })] }),
    ).toMatchObject({
      templateFixed: REPLY_SETTINGS_DEFAULT.templateFixed,
      styleNote: null,
    });
  });
});
