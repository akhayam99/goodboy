import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S04 } from '../figures';
import { SITE } from '../site';

export const HowItWorks = () => (
  <Block
    id="how"
    headingId="h2-how"
    heading="How it works"
    sub="Give Goodboy a goal and a workflow runs it as steps, each one a fresh agent with a short brief."
    isAlt
  >
    <div className="stackText">
      <p>
        In Orchestrated mode a model picks the next step after each one finishes and writes down
        why.
      </p>
      <p>
        Press New and pick Run a workflow: the same builder opens there, and the session and its run
        start together. Or start blank and add the goal later.
      </p>
      <p>
        Heading somewhere you did not mean? Leave a hint for the next decision, or have it read
        right away.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#workflows`}>How workflows work</More>
        <SeeHow anchor="workflows" />
      </div>
    </div>
    <Shot figure={S04} />
  </Block>
);
