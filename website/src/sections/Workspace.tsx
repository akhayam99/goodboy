import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { WORKSPACE } from '../figures';
import { SITE } from '../site';

export const Workspace = () => (
  <Block
    id="workspace"
    headingId="h2-workspace"
    heading="One workspace for all your repos"
    sub="Real work rarely lives in one repo. A workspace holds all of them, and each task reaches into the ones it needs."
    isAlt
  >
    <Shot figure={WORKSPACE} />
    <div className="stackText">
      <p>
        Add payments-api, notify-relay and ledger-core once. Star the ones agents should read first
        and give each a one-line description. It goes into every agent's brief, so nobody explains
        the codebase twice.
      </p>
      <p>
        A task gets a branch and a pull request only in the repos it changes, each in its own
        working copy, so your checkout stays as it is. Give each workspace its own window, and
        switching between them never stops a running agent.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#workspaces-and-projects`}>How workspaces work</More>
        <SeeHow anchor="workspace-and-projects" />
      </div>
    </div>
  </Block>
);
