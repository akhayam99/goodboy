import { NAMES } from '../../shared/utils/names';

type Params = {
  readonly labels: ReadonlyArray<string>;
};

export const continueAgentsTitleOf = ({ labels }: Params): string =>
  labels.length === 1
    ? `${NAMES.continue} ${labels[0]}`
    : `${NAMES.continue} ${labels.length} stopped agents`;
