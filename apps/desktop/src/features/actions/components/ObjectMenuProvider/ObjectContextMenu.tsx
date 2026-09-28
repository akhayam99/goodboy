import { useEffect, useMemo } from 'react';
import { ContextMenu } from '@goodboy/ui';
import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import type { ObjectMenuRequest } from './objectMenuContext';

type Props = {
  readonly request: ObjectMenuRequest;
  readonly onClose: () => void;
};

export const ObjectContextMenu = ({ request, onClose }: Props) => {
  const env = useActionEnv({ origin: 'menu', anchorKey: request.anchorKey });
  const { noun, actions, run } = useObjectActions({ target: request.target, env });
  const entries = useMemo(() => toMenuEntries({ actions, env, run }), [actions, env, run]);
  const isGone = noun === null || entries.length === 0;

  useEffect(() => {
    if (isGone) {
      onClose();
    }
  }, [isGone, onClose]);

  if (isGone) {
    return null;
  }
  return (
    <ContextMenu
      label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} actions`}
      point={request.point}
      entries={entries}
      onClose={onClose}
    />
  );
};
