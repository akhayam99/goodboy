import { Fragment } from '../components/Fragment';
import { CONTEXT_DECISIONS } from '../figures';
import { SITE } from '../site';

export const Context = () => (
  <Fragment
    id="context"
    eyebrow="Shared context"
    heading="Decisions stay with the task"
    body="Every agent reads the same goal and decisions. A replaced decision says why, and the next agent reads the current one."
    link={{ href: `${SITE.concepts}#shared-context-and-lenses`, label: 'How shared context works' }}
    figures={[CONTEXT_DECISIONS]}
  />
);
