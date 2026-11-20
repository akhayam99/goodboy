import { useCallback, useEffect, useMemo } from 'react';
import { ContextMenu } from '@goodboy/ui';
import { keepRowFocus } from '../../keepRowFocus';
import { useActionEnv } from '../../useActionEnv';
import { useObjectActions } from '../../useObjectActions';
import { toMenuEntries } from '../../toMenuEntries';
import type { ObjectMenuRequest } from './objectMenuContext';

type Props = {
  readonly request: ObjectMenuRequest;
  readonly onClose: () => void;
};

type RunParams = {
  readonly actionId: string;
  readonly choice?: string | null;
};

export const ObjectContextMenu = ({ request, onClose }: Props) => {
  const base = useActionEnv({
    origin: 'menu',
    anchorKey: request.anchorKey,
    viewing: request.viewing ?? null,
  });
  const rowFocus = useMemo(
    () => keepRowFocus({ anchor: request.opener, showToast: base.showToast }),
    [base.showToast, request.opener],
  );
  const env = useMemo(() => ({ ...base, showToast: rowFocus.showToast }), [base, rowFocus]);
  const { noun, actions, run: runAction } = useObjectActions({ target: request.target, env });
  const run = useCallback(
    async (params: RunParams) => {
      await runAction(params);
      rowFocus.restore();
    },
    [rowFocus, runAction],
  );
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
