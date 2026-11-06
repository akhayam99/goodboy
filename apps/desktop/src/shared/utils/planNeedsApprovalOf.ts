import { NAMES } from './names';

type Params = {
  readonly version: number;
};

export const planNeedsApprovalOf = ({ version }: Params): string =>
  `Plan v${version} ${NAMES.needsApproval.toLowerCase()}`;
