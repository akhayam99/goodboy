import type { ShellRailMark } from '@goodboy/ui';
import { needYouWords } from '../../needYouWords';

type Params = {
  readonly count: number;
  readonly tone: 'danger' | 'warning' | null;
  readonly hasUnreadElsewhere: boolean;
};

const UNREAD_MARK: ShellRailMark = { kind: 'dot', name: 'activity in another workspace' };

export const workspaceMarkOf = ({
  count,
  tone,
  hasUnreadElsewhere,
}: Params): ShellRailMark | null => {
  if (tone !== null && count > 0) {
    return {
      kind: 'count',
      count,
      tone,
      name: `${needYouWords({ count })} in other workspaces`,
    };
  }
  return hasUnreadElsewhere ? UNREAD_MARK : null;
};
