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
    isAlt
  >
    <Shot figure={RESOLVE} />
    <div className="stackText">
      <p>
        One Push pushes the fixes, posts the replies and resolves the threads. Some comments deserve
        a no, and the agent can say so with a reason.
      </p>
      <p>
        Want the branch tidy afterwards? Squash and reorder commits with the conflicts shown before
        you apply, and take it back within 30 days.
      </p>
      <div className="linkRow">
        <SeeHow anchor="resolve" />
      </div>
    </div>
  </Block>
);
