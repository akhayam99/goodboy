import { Block } from '../components/Block';
import { More } from '../components/More';
import { Shot } from '../components/Shot';
import { S19 } from '../figures';
import { SITE } from '../site';

export const Integrations = () => (
  <Block
    id="integrations"
    headingId="h2-integrations"
    heading="The cards write themselves"
    sub="Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack. The Inbox puts issues, Slack threads and Sentry errors in one list, plus merge requests from GitLab and Bitbucket."
  >
    <div className="stackText">
      <p>
        A code pasted from chat opens from the right tracker, and a session started from any item
        has its brief already drafted. Agents on any provider can read the ticket and the pull
        request themselves, through Goodboy, which keeps your keys.
      </p>
      <p>In Slack you pick the channels, and a reply can wait for your OK before it goes out.</p>
      <More href={`${SITE.concepts}#integration-surface`}>See where each integration stands</More>
    </div>
    <Shot figure={S19} />
  </Block>
);
