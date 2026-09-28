import { Fragment } from '../components/Fragment';
import { WORKSPACE_PROJECTS } from '../figures';
import { SITE } from '../site';

export const Workspace = () => (
  <Fragment
    id="workspace"
    eyebrow="Workspace and projects"
    heading="One task can span several repos and branches"
    body="A session opens a branch only in the repos it changes, and can hold more than one branch in the same repo. Split the work however you like: one session per change, or one for the whole feature. Each branch gets its own working copy, so your checkout stays as it is."
    link={{ href: `${SITE.concepts}#workspaces-and-projects`, label: 'How workspaces work' }}
    figures={[WORKSPACE_PROJECTS]}
  />
);
