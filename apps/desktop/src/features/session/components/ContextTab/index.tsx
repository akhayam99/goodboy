import { useContext } from 'react';
import type { Session } from '@goodboy/types';
import { PaneShell } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { AskDrawer } from '../../ask/components/AskDrawer';
import { ContextCardsContext } from '../../contextCardsContext';
import { openLens } from '../../openLens';
import { ContextDrawer } from '../ContextDrawer';
import { useContextFocus } from './useContextFocus';

type Props = {
  readonly session: Session;
};

export const ContextTab = ({ session }: Props) => {
  const sessionId = session.id;
  const Cards = useContext(ContextCardsContext);
  const focus = useContextFocus();
  return (
    <PaneShell title={NAMES.context}>
      <section
        aria-label={NAMES.context}
        data-testid="context-tab"
        className="flex min-w-0 flex-col gap-6"
      >
        {Cards === null ? null : <Cards session={session} />}
        <ContextDrawer
          key={sessionId}
          sessionId={sessionId}
          section={focus.section}
          view={focus.view}
          highlight={focus.highlight}
          isPage
          onClose={() => openLens({ sessionId, lens: null })}
        />
        <AskDrawer
          sessionId={sessionId}
          isPage
          onClose={() => openLens({ sessionId, lens: null })}
        />
      </section>
    </PaneShell>
  );
};
