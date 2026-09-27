import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { PhoneFigure } from '../components/PhoneFigure';
import { PhoneResolve } from '../components/phone/PhoneResolve';
import { Shot } from '../components/Shot';
import { RESOLVE } from '../figures';

export const Review = () => (
  <Block
    id="review"
    headingId="h2-review"
    heading="Pull request review"
    sub="Pick the comments and press Resolve. An agent writes each fix as a commit and drafts the reply in your voice, and you approve."
    phone={
      <PhoneFigure caption="Each comment gets a commit or a reply, and you approve">
        <PhoneResolve />
      </PhoneFigure>
    }
    isAlt
  >
    <Shot figure={RESOLVE} />
    <div className="stackText">
      <p>
        One action pushes the fixes, posts the replies and resolves the threads. Some comments
        deserve a no, and the agent can say so with a reason.
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
