import type { OverrideSettings, ReplyVoice, ResolveCommitStyle } from '@goodboy/types';
import { isAttributionEnabled } from '../../shared/utils/attribution';

export type ReplySettings = {
  readonly voice: ReplyVoice;
  readonly styleNote: string | null;
  readonly templateFixed: string;
  readonly templateNoChange: string;
  readonly isSigned: boolean;
  readonly resolveOnGithub: boolean;
  readonly commitStyle: ResolveCommitStyle;
};

export const REPLY_TEMPLATE_FIXED_DEFAULT = '{reason}\n\nFixed in {commit}.';
export const REPLY_TEMPLATE_NO_CHANGE_DEFAULT = '{reason}\n\nLeaving this as is.';

export const REPLY_SETTINGS_DEFAULT: ReplySettings = {
  voice: 'terse',
  styleNote: null,
  templateFixed: REPLY_TEMPLATE_FIXED_DEFAULT,
  templateNoChange: REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
  isSigned: true,
  resolveOnGithub: true,
  commitStyle: 'new',
};

type Layers = ReadonlyArray<OverrideSettings | null | undefined>;

const firstSet = <Key extends keyof OverrideSettings>({
  layers,
  key,
}: {
  readonly layers: Layers;
  readonly key: Key;
}): OverrideSettings[Key] | null => {
  for (const layer of layers) {
    const value = layer?.[key] ?? null;
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const nonBlank = ({ value }: { readonly value: string | null }): string | null =>
  value === null || value.trim() === '' ? null : value;

export const replySettingsOf = ({ layers }: { readonly layers: Layers }): ReplySettings => {
  const signedLayer = layers.find((layer) => (layer?.attributionFooter ?? null) !== null) ?? null;
  return {
    voice: firstSet({ layers, key: 'replyVoice' }) ?? REPLY_SETTINGS_DEFAULT.voice,
    styleNote: nonBlank({ value: firstSet({ layers, key: 'replyStyleNote' }) }),
    templateFixed:
      nonBlank({ value: firstSet({ layers, key: 'replyTemplateFixed' }) }) ??
      REPLY_TEMPLATE_FIXED_DEFAULT,
    templateNoChange:
      nonBlank({ value: firstSet({ layers, key: 'replyTemplateNoChange' }) }) ??
      REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
    isSigned: isAttributionEnabled({ overrides: signedLayer }),
    resolveOnGithub:
      firstSet({ layers, key: 'resolveOnGithub' }) ?? REPLY_SETTINGS_DEFAULT.resolveOnGithub,
    commitStyle:
      firstSet({ layers, key: 'resolveCommitStyle' }) ?? REPLY_SETTINGS_DEFAULT.commitStyle,
  };
};
