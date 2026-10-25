import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../../../../actions/ObjectOverflowMenu';
import type { ObjectTarget } from '../../../../../actions/types';

const LABEL = 'Done lane actions';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
};

export const DoneLaneMenu = ({ sessions }: Props) => {
  const target = useMemo(
    (): ObjectTarget => ({ kind: 'doneLane', sessionIds: sessions.map((session) => session.id) }),
    [sessions],
  );
  return <ObjectOverflowMenu target={target} label={LABEL} />;
};
