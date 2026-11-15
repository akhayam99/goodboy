import { countNoun } from '../../shared/utils/countNoun';
import type { FlowWord } from '../../shared/lib/flowWordOf';
import type { BranchLead } from './branchLeadsOf';

type Params = {
  readonly leads: ReadonlyArray<BranchLead>;
  readonly word: FlowWord;
};

type CountParams = {
  readonly leads: ReadonlyArray<BranchLead>;
  readonly dots: ReadonlyArray<BranchLead['dot']>;
};

const leadsInDotsCountOf = ({ leads, dots }: CountParams): number =>
  leads.filter((lead) => dots.includes(lead.dot)).length;

const storyHeadOf = ({ leads, word }: Params): string => {
  const waiting = leadsInDotsCountOf({ leads, dots: ['needsYou', 'failed'] });
  if (waiting > 0) {
    return waiting === 1
      ? `${word} waits for you on this branch.`
      : `${word} waits for you on ${waiting} runs here.`;
  }
  if (leadsInDotsCountOf({ leads, dots: ['running'] }) > 0) {
    return `${word} is working on this branch.`;
  }
  if (leadsInDotsCountOf({ leads, dots: ['done', 'stopped'] }) === leads.length) {
    return `${word} finished its work on this branch.`;
  }
  return `${word} is resting on this branch.`;
};

export const branchStoryLineOf = ({ leads, word }: Params): string | null => {
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
  const head = storyHeadOf({ leads, word });
  return agents === 0 ? head : `${head} ${countNoun({ count: agents, one: 'agent' })} ran here.`;
};
