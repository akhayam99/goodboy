import type { ProviderId } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { PROVIDER_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
};

export const recommendationSummary = ({ provider, model }: Params): string => {
  const label = PROVIDER_LABEL[provider];
  if (model == null) {
    return label;
  }
  const resolved = resolveStoredModelSelection({ provider, id: model });
  if (resolved.report?.kind === 'unknown') {
    return label;
  }
  return `${label} · ${modelLabel(resolved.selection.key)}`;
};
