import { Fragment } from '../components/Fragment';
import { WORKSPACE_PROJECTS } from '../figures';
import { SITE } from '../site';

export const Workspace = () => (
  <Fragment
    id="workspace"
    eyebrow="Workspace and projects"
    heading="One task can cover several repos and branches"
    body="Nothing outside the change is touched, and two fixes can run side by side in the same codebase. Split the work however you like: one session per change, or one for the whole feature. Each branch gets its own working copy, so your checkout stays as it is."
    link={{ href: `${SITE.concepts}#workspaces-and-projects`, label: 'How workspaces work' }}
    figures={[WORKSPACE_PROJECTS]}
  />
);
