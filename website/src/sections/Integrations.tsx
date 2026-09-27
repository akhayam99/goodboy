import { Block } from '../components/Block';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S19 } from '../figures';
import { SITE } from '../site';

type Tool = {
  readonly brand: BrandId;
  readonly name: string;
};

const TOOLS: readonly Tool[] = [
  { brand: 'github', name: 'GitHub' },
  { brand: 'gitlab', name: 'GitLab' },
  { brand: 'bitbucket', name: 'Bitbucket' },
  { brand: 'jira', name: 'Jira' },
  { brand: 'linear', name: 'Linear' },
  { brand: 'sentry', name: 'Sentry' },
  { brand: 'slack', name: 'Slack' },
];

export const Integrations = () => (
  <Block
    id="integrations"
    headingId="h2-integrations"
    heading="The cards write themselves"
    sub="Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack. The Inbox puts issues, Slack threads and Sentry errors in one list, plus merge requests from GitLab and Bitbucket."
  >
    <ul className="toolRow" aria-label="Supported tools">
      {TOOLS.map((tool) => (
        <li key={tool.brand}>
          <BrandMark brand={tool.brand} size={20} />
          <span>{tool.name}</span>
        </li>
      ))}
    </ul>
    <div className="stackText">
      <p>
        A code pasted from chat opens from the right tracker, and a session started from any item
        has its brief already drafted. Agents on any provider can read the ticket and the pull
        request themselves, through Goodboy, which keeps your keys.
      </p>
      <p>In Slack you pick the channels, and a reply can wait for your OK before it goes out.</p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#integration-surface`}>See where each integration stands</More>
        <SeeHow anchor="supported-tools" />
      </div>
    </div>
    <Shot figure={S19} />
  </Block>
);
