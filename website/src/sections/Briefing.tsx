import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S08 } from '../figures';
import { SITE } from '../site';

export const Briefing = () => (
  <Block
    headingId="h2-briefing"
    heading="The briefing belongs to the task, not the chat"
    sub="Every agent on a task reads the same goal, the decisions made so far and a summary that updates after each turn."
    isAlt
  >
    <div className="stackText">
      <p>
        Decisions are numbered and signed, and when one changes, the reason stays next to it. Hand
        the task from Claude to Codex and the next agent picks up where the last one stopped.
      </p>
      <p>Curious what it was told? Open the agent and read exactly what it was sent.</p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#shared-context`}>How shared context works</More>
        <SeeHow anchor="shared-context" />
      </div>
    </div>
    <Shot figure={S08} />
  </Block>
);
