import type { StateTone } from '../../../shared/components/IssueStateBadge';
import type { JiraStatusCategoryKey } from './client';

type Params = {
  readonly statusCategory: JiraStatusCategoryKey;
};

export const statusCategoryTone = ({ statusCategory }: Params): StateTone => {
  switch (statusCategory) {
    case 'new':
      return 'info';
    case 'indeterminate':
      return 'warning';
    case 'done':
      return 'success';
    case '':
      return 'neutral';
    default: {
      const unreachable: never = statusCategory;
      return unreachable;
    }
  }
};
