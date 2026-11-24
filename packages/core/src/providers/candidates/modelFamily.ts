import type { ProviderId } from '@goodboy/types';
import { catalogModelForId } from '../catalogModelForId';

export type ModelFamily = string;

const FAMILY_OF_GROUP: Readonly<Record<string, ModelFamily | null>> = {
  Opus: 'claude',
  Sonnet: 'claude',
  Haiku: 'claude',
  Fable: 'claude',
  GPT: 'gpt',
  Codex: 'gpt',
  Auto: null,
};

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
};

export const modelFamily = ({ provider, model }: Params): ModelFamily | null => {
  const group = catalogModelForId({ provider, modelId: model })?.presentation.group;
  if (group == null) {
    return null;
  }
  const known = FAMILY_OF_GROUP[group];
  if (known !== undefined) {
    return known;
  }
  return group.toLowerCase().replaceAll(' ', '-');
};
