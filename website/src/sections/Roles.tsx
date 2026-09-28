import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S04r } from '../figures';

export const Roles = () => (
  <Block
    id="roles"
    headingId="h2-roles"
    heading="The right model for each step"
    sub="Nine roles come in the box, and each step of a workflow carries its own provider, model and effort."
    isAlt
  >
    <div className="stackText">
      <p>
        In this run a scout read the posting path for two cents. The planner is the step that has to
        think, and at $1.28 it is where the money goes.
      </p>
      <p>Set a spend limit and the run pauses when it gets there, or only warns you, your call.</p>
      <div className="linkRow">
        <SeeHow anchor="model-per-step" />
      </div>
    </div>
    <Shot figure={S04r} />
  </Block>
);
