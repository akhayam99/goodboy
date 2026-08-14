import type { StateTone } from '@goodboy/ui';
import type { JiraStatusCategoryKey } from './client';

type Params = {
  readonly statusCategory: JiraStatusCategoryKey;
};

export const statusCategoryTone = ({ statusCategory }: Params): StateTone => {
  switch (statusCategory) {
    case 'new':
      return 'neutral';
    case 'indeterminate':
      return 'info';
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
