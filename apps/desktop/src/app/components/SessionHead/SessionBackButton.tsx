import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NAMES } from '../../../shared/utils/names';
import { sessionCrumbsOf } from './sessionCrumbsOf';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionBackButton = ({ sessionId }: Props) => {
  const parent = useAppStore((state) => {
    const crumbs = sessionCrumbsOf({ state, sessionId });
    return crumbs[crumbs.length - 2]?.label ?? NAMES.overview;
  });
  const up = useAppStore((state) => state.up);
  return (
    <IconButton
      icon={ArrowLeft}
      label={`Back to ${parent}`}
      shortcut="nav.crumbUp"
      variant="outline"
      data-session-back=""
      onClick={() => up()}
    />
  );
};
