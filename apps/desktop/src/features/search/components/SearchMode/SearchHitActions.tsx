import { useMemo } from 'react';
import { Eyebrow, MenuList } from '@goodboy/ui';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { toMenuEntries } from '../../../actions/toMenuEntries';
import type { ObjectTarget } from '../../../actions/types';

type Props = {
  readonly target: ObjectTarget;
  readonly onDone: () => void;
};

export const SearchHitActions = ({ target, onDone }: Props) => {
  const env = useActionEnv({ origin: 'palette' });
  const { noun, actions, run } = useObjectActions({ target, env });
  const entries = useMemo(() => toMenuEntries({ actions, env, run }), [actions, env, run]);
  if (entries.length === 0) {
    return null;
  }
  return (
    <section aria-label={`Actions for this ${noun ?? 'result'}`} className="flex flex-col gap-1">
      <Eyebrow label="Actions" muted />
      <div data-search-actions>
        <MenuList
          label={`Actions for this ${noun ?? 'result'}`}
          entries={entries}
          onClose={onDone}
          isAutoFocus={false}
        />
      </div>
    </section>
  );
};
