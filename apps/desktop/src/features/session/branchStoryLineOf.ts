import { countNoun } from '../../shared/utils/countNoun';
import type { BranchLead } from './branchLeadsOf';

type Params = {
  readonly leads: ReadonlyArray<BranchLead>;
};

type CountParams = {
  readonly leads: ReadonlyArray<BranchLead>;
  readonly dots: ReadonlyArray<BranchLead['dot']>;
};

const leadsInDotsCountOf = ({ leads, dots }: CountParams): number =>
  leads.filter((lead) => dots.includes(lead.dot)).length;

const storyHeadOf = ({ leads }: Params): string => {
  const waiting = leadsInDotsCountOf({ leads, dots: ['needsYou', 'failed'] });
  if (waiting > 0) {
    return waiting === 1
      ? 'Auto waits for you on this branch.'
      : `Auto waits for you on ${waiting} runs here.`;
  }
  if (leadsInDotsCountOf({ leads, dots: ['running'] }) > 0) {
    return 'Auto is working on this branch.';
  }
  if (leadsInDotsCountOf({ leads, dots: ['done', 'stopped'] }) === leads.length) {
    return 'Auto finished its work on this branch.';
  }
  return 'Auto is resting on this branch.';
};

export const branchStoryLineOf = ({ leads }: Params): string | null => {
  if (leads.length === 0) {
    return null;
  }
  const agents = leads
    .flatMap((lead) => lead.items)
    .reduce((sum, item) => {
      if (item.kind === 'agent') {
        return sum + 1;
      }
      return item.kind === 'fold' ? sum + item.count : sum;
    }, 0);
  const head = storyHeadOf({ leads });
  return agents === 0 ? head : `${head} ${countNoun({ count: agents, one: 'agent' })} ran here.`;
};
