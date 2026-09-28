import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { SWITCH } from '../figures';

export const Switch = () => (
  <Block
    id="switch"
    headingId="h2-switch"
    heading="Switch tasks without losing your place"
    sub="Five tasks in flight is a normal day. Each one stays where you left it, so coming back takes a look, not ten minutes of scrolling."
    isAlt
  >
    <Shot figure={SWITCH} />
    <div className="stackText">
      <p>
        The activity bar next to every session lists all your tasks by where they stand: building,
        running, needs you and in review. Each row says what it is waiting on, like a question to
        answer or a draft pull request. Open one and its Overview tells you what ran, what was
        decided and what comes next.
      </p>
      <p>
        Everything else Goodboy has to tell you lands in one place. The bell counts what you have
        not read, and the notifications page sorts it by severity, source and workspace, with the
        next step on the rows that need one.
      </p>
      <div className="linkRow">
        <SeeHow anchor="switch-between-tasks" />
      </div>
    </div>
  </Block>
);
