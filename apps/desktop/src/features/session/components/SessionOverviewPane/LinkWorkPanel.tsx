import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, Session, SessionExternalTaskProvider } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';
import type { LinkChoice } from './linkScope';
import { LinkWorkPicker } from './LinkWorkPicker';
import { useLinkWorkItems } from './useLinkWorkItems';

type Props = {
  readonly initialQuery?: string;
  readonly initialSource?: SessionExternalTaskProvider;
  readonly session: Session;
  readonly onLinked: () => void;
  readonly onClose: () => void;
};

export const LinkWorkPanel = ({
  session,
  onLinked,
  onClose,
  initialQuery = '',
  initialSource,
}: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const starExternalTask = useAppStore((state) => state.starExternalTask);
  const work = useLinkWorkItems({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    query,
  });

  const link = async (task: LaunchExternalTask, choice: LinkChoice): Promise<void> => {
    setError(null);
    setIsLinking(true);
    const createdAt = new Date().toISOString() as IsoDateTime;
    try {
      await linkSessionExternalTask(session.id, {
        ...task,
        createdAt,
        relation: choice.relation,
      });
      onLinked();
    } catch (linkError: unknown) {
      setError(formatError(linkError));
    } finally {
      setIsLinking(false);
    }
  };

  const star = async (task: LaunchExternalTask): Promise<void> => {
    setError(null);
    setIsLinking(true);
    try {
      await starExternalTask({ workspaceId: session.workspaceId, task });
      onLinked();
    } catch (starError: unknown) {
      setError(formatError(starError));
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <LinkWorkPicker
      query={query}
      onQueryChange={setQuery}
      items={work.items}
      lookedUp={work.lookedUp}
      linkedKeys={work.linkedKeys}
      starredKeys={work.starredKeys}
      sources={work.sources}
      {...(initialSource !== undefined ? { initialSource } : {})}
      isLoading={work.isLoading}
      isLinking={isLinking}
      error={error}
      onLink={(task, choice) => void link(task, choice)}
      onStar={(task) => void star(task)}
      onClose={onClose}
    />
  );
};
