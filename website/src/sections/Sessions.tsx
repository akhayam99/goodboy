import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { AGENTS } from '../figures';
import { SITE } from '../site';

export const Sessions = () => (
  <Block
    id="how"
    headingId="h2-how"
    heading="One session, many chats"
    sub="A task gets one session. Inside it, every chat has one job, and each one runs on the provider that fits it."
  >
    <div className="contrast">
      <div className="contrastCard before">
        <h3>With one chat</h3>
        <p>
          The plan, the code, the tests and the review pile up in the same thread. The model loses
          the start of it, and changing tool means telling the whole story again.
        </p>
      </div>
      <div className="contrastCard after">
        <h3>With Goodboy</h3>
        <p>
          A scout reads the code, a planner decides, implementers write and a tester checks. Each
          chat is short and focused, and all of them read the same goal and decisions.
        </p>
      </div>
    </div>
    <Shot figure={AGENTS} />
    <div className="stackText">
      <p>
        Here eight chats work on one webhook fix. The scouts cost cents on light models, the planner
        gets Opus, and the code goes to GPT-5.6 Sol and Kimi K3. You see who did what, on which
        model, for how much.
      </p>
      <p>
        Nine roles come in the box, from Scout to Reviewer. Start a single agent when that is all
        the task needs, or let a workflow line them up.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#how-they-fit-together`}>
          How sessions and agents fit together
        </More>
        <SeeHow anchor="roles" />
      </div>
    </div>
  </Block>
);
