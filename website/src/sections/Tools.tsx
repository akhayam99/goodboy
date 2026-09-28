import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { ToolRow, type Tool } from '../components/ToolRow';
import { SITE } from '../site';

const PROVIDERS: readonly Tool[] = [
  { brand: 'anthropic', name: 'Claude' },
  { brand: 'codex', name: 'Codex' },
  { brand: 'cursor', name: 'Cursor' },
  { brand: 'gemini', name: 'Gemini' },
  { brand: 'opencode', name: 'OpenCode' },
  { brand: 'openrouter', name: 'OpenRouter' },
  { brand: 'moonshot', name: 'Moonshot' },
];

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
  <Block
    id="tools"
    headingId="h2-tools"
    heading="Supported tools"
    sub="Seven providers for the agents, and the tools your team already works in."
    isAlt
  >
    <div className="toolGroups">
      <ToolRow label="Providers" items={PROVIDERS} />
      <ToolRow label="Your tools" items={TOOLS} />
    </div>
    <div className="linkRow">
      <More href={SITE.providersDoc}>Set up a provider</More>
      <SeeHow anchor="supported-tools" />
    </div>
  </Block>
);
