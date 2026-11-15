import type { Session } from '@goodboy/types';

import { openSessionPage } from '../../../../features/session/openSessionPage';
import type { PageCountFacts } from '../../../../features/session/pageCountWord';
import type { Page } from '../../../../features/session/pageRegistry';
import type { CurrentSign } from '../../../../features/workspace/components/SessionActivityBar/currentSign';
import { SessionPageRow } from '../SessionPageRow';

type Props = {
  readonly session: Session;
  readonly pages: ReadonlyArray<Page>;
  readonly facts: PageCountFacts;
  readonly sign: CurrentSign;
};

export const SessionPages = ({ session, pages, facts, sign }: Props) => {
  const sessionId = session.id;

  return (
    <ul aria-label="Pages" className="flex flex-col" data-testid="session-pages">
      {pages.map((page) => (
        <li key={page.id}>
          <SessionPageRow
            page={page}
            facts={facts}
            isCurrent={sign === page.id}
            onOpen={() => openSessionPage({ sessionId, page })}
          />
        </li>
      ))}
    </ul>
  );
};
