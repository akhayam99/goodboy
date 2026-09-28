import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';
import { LinkWorkPicker } from './LinkWorkPicker';
import { useLinkWorkItems } from './useLinkWorkItems';

type Props = {
  readonly session: Session;
  readonly onLinked: () => void;
  readonly onClose: () => void;
};

export const LinkWorkPanel = ({ session, onLinked, onClose }: Props) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const work = useLinkWorkItems({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    query,
  });

  const link = async (task: LaunchExternalTask): Promise<void> => {
    setError(null);
    setIsLinking(true);
    try {
      await linkSessionExternalTask(session.id, {
        ...task,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
      onLinked();
    } catch (linkError: unknown) {
      setError(formatError(linkError));
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
      sources={work.sources}
      isLoading={work.isLoading}
      isLinking={isLinking}
      error={error}
      onLink={(task) => void link(task)}
      onClose={onClose}
    />
  );
};
