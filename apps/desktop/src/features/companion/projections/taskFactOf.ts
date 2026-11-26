import type { InboxRecord } from '../../inbox/types';
import { safeTextOf } from './safeTextOf';
import type { TaskFact } from './workspaceScope';

export const TASK_DESCRIPTION_MAX = 400;
export const TASK_ASSIGNEE_MAX = 80;
export const TASK_STATE_MAX = 40;

type Params = {
  readonly record: InboxRecord;
};

type DescriptionParams = {
  readonly text: string | null | undefined;
};

type NameParams = {
  readonly name: string | null | undefined;
};

const descriptionOf = ({ text }: DescriptionParams): string | null => {
  const clean = safeTextOf({ text: (text ?? '').trim(), max: TASK_DESCRIPTION_MAX });
  return clean.length === 0 ? null : clean;
};

const assigneeOf = ({ name }: NameParams): string | null => {
  const clean = safeTextOf({ text: (name ?? '').trim(), max: TASK_ASSIGNEE_MAX });
  return clean.length === 0 ? null : clean;
};

export const taskFactOf = ({ record }: Params): TaskFact => {
  const stateLabel = safeTextOf({ text: record.stateLabel.trim(), max: TASK_STATE_MAX });
  const { payload } = record;
  const base = { stateLabel: stateLabel.length === 0 ? null : stateLabel };
  switch (payload.provider) {
    case 'linear':
      return {
        ...base,
        description: descriptionOf({ text: payload.issue.description }),
        assignee: assigneeOf({ name: payload.issue.assignee?.name }),
      };
    case 'jira':
      return {
        ...base,
        description: descriptionOf({ text: payload.issue.description }),
        assignee: assigneeOf({ name: payload.issue.assignee?.displayName }),
      };
    case 'gitlab':
      return {
        ...base,
        description:
          payload.kind === 'issue' ? descriptionOf({ text: payload.issue.description }) : null,
        assignee: null,
      };
    case 'github':
    case 'sentry':
    case 'slack':
    case 'bitbucket':
      return { ...base, description: null, assignee: null };
    default: {
      const unreachable: never = payload;
      return unreachable;
    }
  }
};
