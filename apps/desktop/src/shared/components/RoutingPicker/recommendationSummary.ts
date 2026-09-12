import type { ModelEffort, ProviderId } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
} from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
  readonly effort?: ModelEffort | null;
};

export const recommendationSummary = ({ provider, model, effort }: Params): string => {
  const label = PROVIDER_LABEL[provider];
  if (model == null) {
    return label;
  }
  const resolved = resolveStoredModelSelection({ provider, id: model });
  if (resolved.report?.kind === 'unknown') {
    return label;
  }
  const named = `${label} · ${modelLabel(resolved.selection.key)}`;
  if (effort == null) {
    return named;
  }
  return `${named} · ${EFFORT_LABEL[effort]}`;
};
