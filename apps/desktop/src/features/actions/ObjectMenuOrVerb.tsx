import type { ReactNode } from 'react';
import { ObjectActionVerb } from './ObjectActionVerb';
import { useActionEnv } from './useActionEnv';
import { useObjectActions } from './useObjectActions';
import type { ObjectTarget } from './types';

type Props = {
  readonly target: ObjectTarget;
  readonly menu: ReactNode;
};

const MIN_MENU_ACTIONS = 2;

export const ObjectMenuOrVerb = ({ target, menu }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const { actions } = useObjectActions({ target, env });
  if (actions.length >= MIN_MENU_ACTIONS) {
    return <>{menu}</>;
  }
  const lone = actions[0];
  if (lone === undefined) {
    return null;
  }
  return <ObjectActionVerb target={target} actionId={lone.id} />;
};
