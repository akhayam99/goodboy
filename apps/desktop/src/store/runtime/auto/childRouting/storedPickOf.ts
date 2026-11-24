import { isEffortLevel, PROVIDER_IDS, type WorkflowModelPick } from '@goodboy/types';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';

type Params = {
  readonly routing: Readonly<Record<string, unknown>>;
};

export const storedPickOf = ({ routing }: Params): WorkflowModelPick | null => {
  const providerText = textFieldOf({ source: routing, key: 'provider' });
  const provider = PROVIDER_IDS.find((candidate) => candidate === providerText);
  const model = textFieldOf({ source: routing, key: 'model' });
  if (provider === undefined || model === null) {
    return null;
  }
  const effort = textFieldOf({ source: routing, key: 'effort' });
  return { provider, model, effort: effort !== null && isEffortLevel(effort) ? effort : null };
};
