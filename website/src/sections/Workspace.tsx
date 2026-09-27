import { Block } from '../components/Block';
import { More } from '../components/More';
import { Shot } from '../components/Shot';
import { S10 } from '../figures';
import { SITE } from '../site';

export const Workspace = () => (
  <Block
    headingId="h2-workspace"
    heading="Many repos, one goal"
    sub="A workspace holds all your repos, and the goal decides which ones get a branch."
  >
    <div className="stackText">
      <p>
        Here the fix touches <code>payments-api</code> and <code>notify-relay</code>, so each gets
        its own branch and pull request, while <code>ledger-core</code> is only read.
      </p>
      <p>Your own checkout stays as you left it.</p>
      <More href={SITE.concepts}>How workspaces work</More>
    </div>
    <Shot figure={S10} />
  </Block>
);
