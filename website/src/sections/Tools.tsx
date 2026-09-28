import './Tools.css';
import { PROVIDERS } from '../components/BrandIcons';
import { ToolRow, type Tool } from '../components/ToolRow';
import { SITE } from '../site';

const PROVIDER_TOOLS: readonly Tool[] = PROVIDERS.map((provider) => ({
  brand: provider.id,
  name: provider.name,
}));

const TOOLS: readonly Tool[] = [
  { brand: 'github', name: 'GitHub', use: 'Issues and pull requests' },
  { brand: 'gitlab', name: 'GitLab', use: 'Issues and merge requests' },
  { brand: 'bitbucket', name: 'Bitbucket', use: 'Pull requests' },
  { brand: 'jira', name: 'Jira', use: 'Issues' },
  { brand: 'linear', name: 'Linear', use: 'Issues' },
  { brand: 'sentry', name: 'Sentry', use: 'Errors' },
  { brand: 'slack', name: 'Slack', use: 'Threads and replies' },
];

export const Tools = () => (
  <section className="tools" id="tools" aria-labelledby="tools-title">
    <h2 id="tools-title" className="sectionTitle">
      Supported tools
    </h2>
    <ToolRow label="Providers" items={PROVIDER_TOOLS} />
    <ToolRow label="Your tools" items={TOOLS} />
    <a className="textLink" href={`${SITE.featureGuide}#provider-connection`}>
      Set up a provider <span aria-hidden="true">→</span>
    </a>
  </section>
);
