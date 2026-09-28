import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { INBOX } from '../figures';
import { SITE } from '../site';

export const Inbox = () => (
  <Block
    id="integrations"
    headingId="h2-integrations"
    heading="Inbox"
    sub="Issues, pull requests, Slack threads and Sentry errors in one list. The cards write themselves."
    isAlt
  >
    <Shot figure={INBOX} />
    <div className="stackText">
      <p>
        Paste a code like HBL-412 and it opens from the right tracker. Start a session from any item
        and its brief is already drafted.
      </p>
      <p>
        Agents on any provider can read the ticket and the pull request themselves, through Goodboy,
        which keeps your keys. In Slack you pick the channels, and a reply waits for your OK.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#integrations`}>How integrations work</More>
        <SeeHow anchor="inbox" />
      </div>
    </div>
  </Block>
);
