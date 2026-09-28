import { Fragment } from '../components/Fragment';
import { CONTEXT_CHANGES } from '../figures';
import { SITE } from '../site';

export const Context = () => (
  <Fragment
    id="context"
    eyebrow="Shared context"
    heading="Decisions live inside the task"
    body="Every agent reads the same goal and the same list of what was agreed. When a decision changes, the panel shows what was added, replaced or withdrawn since you last looked, and the next agent is briefed on the current set. Remove one by mistake and Undo brings it back while the panel is open."
    link={{ href: `${SITE.featureGuide}#shared-context`, label: 'How shared context works' }}
    figures={[CONTEXT_CHANGES]}
  />
);
