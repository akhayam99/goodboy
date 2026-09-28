import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { RESOLVE } from '../figures';

export const Review = () => (
  <Block
    id="review"
    headingId="h2-review"
    heading="Pull request review"
    sub="Draft fixes for the open comments. An agent writes each fix as a commit and drafts the reply in your voice, and you accept or edit it."
  >
    <Shot figure={RESOLVE} />
    <div className="stackText">
      <p>
        One Push pushes the fixes, posts the replies and resolves the threads. Some comments deserve
        a no, and the agent can say so with a reason.
      </p>
      <p>
        Replies come out in your voice, terse, friendly or formal, or learned from the last replies
        you wrote. A fix still lands when the branch got new commits in the meantime.
      </p>
      <div className="linkRow">
        <SeeHow anchor="resolve" />
      </div>
    </div>
  </Block>
);
