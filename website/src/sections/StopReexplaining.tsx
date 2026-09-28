import { Handoff } from '../components/mocks/Handoff';
import { Beat } from './Beat';

export const StopReexplaining = () => (
  <Beat
    id="context"
    isBand
    heading={
      <>
        Stop <span className="nowrap">re-explaining</span> yourself
      </>
    }
    body="The goal, the plan and each decision stay with the task, and every agent starts from them. When a provider hits its limit or stops answering, the turn moves to another provider you connected, with the same brief."
    links={[
      { label: 'How shared context works', anchor: 'shared-context' },
      { label: 'How fallback works', anchor: 'fallback-when-a-limit-is-hit' },
    ]}
    fine="Moving to another provider needs a second one connected."
  >
    <Handoff />
  </Beat>
);
