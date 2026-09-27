import { Block } from '../components/Block';
import { More } from '../components/More';
import { Shot } from '../components/Shot';
import { S03 } from '../figures';
import { SITE } from '../site';

export const Activity = () => (
  <Block
    headingId="h2-coming"
    heading="Come back and see what ran"
    sub="Open a task hours later and the story is on one timeline: which agent ran, what it cost, what was decided."
  >
    <div className="stackText">
      <p>
        Above it sits the one move that unblocks the task, here a question only you can answer. A
        queued step even gives a rough time, learned from your own past runs.
      </p>
      <More href={`${SITE.concepts}#the-object-model`}>Why the task comes first</More>
    </div>
    <Shot figure={S03} />
  </Block>
);
