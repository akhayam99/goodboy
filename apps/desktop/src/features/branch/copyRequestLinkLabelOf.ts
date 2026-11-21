import type { PullRequestHost } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import { requestNounLabel } from './requestNounLabel';

type Params = {
  readonly host: PullRequestHost;
};

export const copyRequestLinkLabelOf = ({ host }: Params): string =>
  `${NAMES.copy} ${requestNounLabel({ host }).toLowerCase()} link`;
