import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { FIND } from '../figures';

export const Find = () => (
  <Block
    id="find"
    headingId="h2-find"
    heading="Go anywhere, find anything"
    sub="Two shortcuts cover most of the app. ⌘K takes you anywhere and runs any action. ⌘F finds anything you or an agent wrote."
  >
    <Shot figure={FIND} />
    <div className="stackText">
      <p>
        ⌘K opens on what you are looking at, so the actions of that agent or session come first.
        Type a few letters and it finds any session in any workspace, a plan, a page or a script.
        Right click any row and the same actions are there.
      </p>
      <p>
        ⌘F searches every message, plan, decision, issue and pull request across your sessions, and
        filters by type, project, provider, status or date. Pick a result and you land on it in
        context. The index stays on your computer.
      </p>
      <div className="linkRow">
        <SeeHow anchor="go-anywhere-find-anything" />
      </div>
    </div>
  </Block>
);
