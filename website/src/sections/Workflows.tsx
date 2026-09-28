import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { BUILDER } from '../figures';
import { SITE } from '../site';

export const Workflows = () => (
  <Block
    id="workflows"
    headingId="h2-workflows"
    heading="Workflows"
    sub="Give Goodboy a goal and a workflow runs it as steps, each one a fresh agent with a short brief."
  >
    <Shot figure={BUILDER} />
    <div className="stackText">
      <p>
        In Orchestrated mode a model picks the next step after each one finishes, and writes down
        why. Rather decide yourself? Lay out the steps by hand, or start from a preset.
      </p>
      <p>
        Press New and pick Run a workflow: the same builder opens there, and the session and its run
        start together. Or start blank and add the goal later.
      </p>
      <p>
        Heading somewhere you did not mean? Leave a hint for the next decision, or have it read
        right away. Set a spend cap and the run pauses when it gets there.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#workflows`}>How workflows work</More>
        <SeeHow anchor="workflows" />
      </div>
    </div>
  </Block>
);
