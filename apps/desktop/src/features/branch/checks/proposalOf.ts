import { sectionOf } from './sectionOf';

type Params = {
  readonly text: string;
};

export const proposalOf = ({ text }: Params): string | null => {
  const proposal = sectionOf({ text, heading: 'Proposed fix' });
  return proposal === null || proposal.body.length === 0 ? null : proposal.body;
};
