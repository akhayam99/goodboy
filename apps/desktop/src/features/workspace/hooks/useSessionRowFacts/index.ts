import type { Session } from '@goodboy/types';
import { inlineMarkdownText } from '@goodboy/ui';
import { sessionNodeOf, type SessionNode } from '../../../session/sessionNode';
import { sessionRowTitle, type SessionRowTitle } from '../../../../shared/utils/sessionTitle';
import { useSessionSummary, type SessionSummary } from '../useSessionSummary';

export type SessionRowFacts = {
  readonly summary: SessionSummary;
  readonly node: SessionNode;
  readonly rowTitle: SessionRowTitle;
  readonly keys: ReadonlyArray<string>;
  readonly title: string;
  readonly plainTitle: string;
};

type Params = {
  readonly session: Session;
  readonly isArchived?: boolean;
};

export const useSessionRowFacts = ({ session, isArchived = false }: Params): SessionRowFacts => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const rowTitle = sessionRowTitle({ session, tasks: summary.tasks });
  return {
    summary,
    node,
    rowTitle,
    keys: rowTitle.keys,
    title: rowTitle.title,
    plainTitle: inlineMarkdownText({ text: rowTitle.title }),
  };
};
