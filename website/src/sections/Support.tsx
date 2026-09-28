import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { SUPPORT } from '../figures';
import { SITE } from '../site';

export const Support = () => (
  <Block
    id="support"
    headingId="h2-support"
    heading="Support the project"
    sub="The best support is using it. Run Goodboy on your real work, and when something feels off or you have an idea, tell us from inside the app."
  >
    <Shot figure={SUPPORT} />
    <div className="stackText">
      <p>
        Press ⌘I on any screen, or Report a bug in the footer, and write one line. The version, your
        system, the screen you were on and your CLI versions come along as chips you can remove, and
        What gets sent shows everything before it leaves.
      </p>
      <p>
        <b>&quot;This feels off&quot; is a valid bug report.</b> So is an idea.
      </p>
      <div className="linkRow">
        <More href={SITE.issues}>Open an issue</More>
        <SeeHow anchor="report-a-bug" />
      </div>
    </div>
  </Block>
);
