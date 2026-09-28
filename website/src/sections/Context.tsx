import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { CONTEXT } from '../figures';
import { SITE } from '../site';

export const Context = () => (
  <Block
    id="context"
    headingId="h2-context"
    heading="Shared context"
    sub="The briefing belongs to the task, not the chat. Every agent reads the same goal, the decisions so far and a summary that updates after each turn."
  >
    <Shot figure={CONTEXT} />
    <div className="stackText">
      <p>
        Decisions are numbered and signed, and the ones Goodboy records show why they were made.
        When one changes, the reason stays next to it. Hand the task from Claude to Codex and the
        next agent picks up where the last one stopped.
      </p>
      <p>Curious what an agent was told? Open it and read exactly what it was sent.</p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#shared-context-and-lenses`}>How shared context works</More>
        <SeeHow anchor="shared-context" />
      </div>
    </div>
  </Block>
);
