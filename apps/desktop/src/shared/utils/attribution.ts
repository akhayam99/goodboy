import type { OverrideSettings } from '@goodboy/types';

export const ATTRIBUTION_TEXT = 'Written by Goodboy';

export type AttributionSyntax = 'markdown' | 'mrkdwn';

export const ATTRIBUTION_FOOTERS = {
  markdown: `*${ATTRIBUTION_TEXT}*`,
  mrkdwn: `_${ATTRIBUTION_TEXT}_`,
} as const satisfies Record<AttributionSyntax, string>;

const SIGNED_ENDINGS: ReadonlyArray<string> = [
  ATTRIBUTION_TEXT,
  ATTRIBUTION_FOOTERS.markdown,
  ATTRIBUTION_FOOTERS.mrkdwn,
];

type IsAttributionEnabledParams = {
  readonly overrides: OverrideSettings | null | undefined;
};

export const isAttributionEnabled = ({ overrides }: IsAttributionEnabledParams): boolean =>
  overrides?.attributionFooter !== false;

type IsAlreadySignedParams = {
  readonly body: string;
};

const isAlreadySigned = ({ body }: IsAlreadySignedParams): boolean =>
  SIGNED_ENDINGS.some((ending) => body === ending || body.endsWith(`\n${ending}`));

type AppendAttributionParams = {
  readonly body: string;
  readonly isEnabled: boolean;
  readonly syntax: AttributionSyntax;
};

export const appendAttribution = ({ body, isEnabled, syntax }: AppendAttributionParams): string => {
  if (isEnabled === false) {
    return body;
  }
  const footer = ATTRIBUTION_FOOTERS[syntax];
  const trimmed = body.replace(/\s+$/, '');
  if (trimmed === '') {
    return footer;
  }
  if (isAlreadySigned({ body: trimmed })) {
    return trimmed;
  }
  return `${trimmed}\n\n${footer}`;
};

type InsertBeforeAttributionParams = {
  readonly body: string;
  readonly text: string;
};

export const insertBeforeAttribution = ({ body, text }: InsertBeforeAttributionParams): string => {
  const trimmed = body.replace(/\s+$/, '');
  const footer = SIGNED_ENDINGS.find((ending) => trimmed.endsWith(`\n\n${ending}`));
  if (footer === undefined) {
    return `${trimmed}\n\n${text}`;
  }
  const head = trimmed.slice(0, trimmed.length - footer.length).replace(/\s+$/, '');
  return `${head}\n\n${text}\n\n${footer}`;
};
