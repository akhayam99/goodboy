import { Fragment } from '../components/Fragment';
import { WORKSPACE_PROJECTS } from '../figures';
import { SITE } from '../site';

export const Workspace = () => (
  <Fragment
    id="workspace"
    eyebrow="Workspace and projects"
    heading="Every repo a task touches, in one place"
    body="A task opens a branch and a pull request only in the repos it changes, each in its own working copy. Your checkout stays as it is."
    link={{ href: `${SITE.concepts}#workspaces-and-projects`, label: 'How workspaces work' }}
    figures={[WORKSPACE_PROJECTS]}
  />
);
