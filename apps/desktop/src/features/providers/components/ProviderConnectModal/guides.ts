import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

type GuideStep = {
  readonly title: string;
  readonly body: string;
};

export type ProviderGuide = {
  readonly headline: string;
  readonly subscription: string;
  readonly steps: ReadonlyArray<GuideStep>;
  readonly docsUrl: string;
  readonly docsLabel: string;
};

const ANTHROPIC_DOCS = 'https://docs.claude.com/en/docs/claude-code/overview';
const CURSOR_DOCS = 'https://docs.cursor.com/en/cli/installation';
const CODEX_DOCS = 'https://github.com/openai/codex#installation';
const GEMINI_DOCS = 'https://antigravity.google/cli';
const OPENCODE_DOCS = 'https://opencode.ai/docs';
const OPENROUTER_DOCS = 'https://openrouter.ai/docs';

const INSTALL_GUIDES: Partial<Record<ProviderId, ProviderGuide>> = {
  anthropic: {
    headline: 'Install Claude Code',
    subscription: 'Claude Pro or Max subscription on claude.ai.',
    steps: [
      {
        title: 'Watch the install run',
        body: 'npm fetches the Claude Code CLI and registers `claude` on your PATH. Takes 5 to 30 seconds depending on your network.',
      },
      {
        title: 'If it asks for your password',
        body: 'A global npm install can need sudo on macOS without nvm. Click in the terminal and type your password, the prompt accepts input directly.',
      },
      {
        title: 'After install',
        body: 'Goodboy automatically moves to the sign-in step. You stay in the same modal, no re-clicking.',
      },
    ],
    docsUrl: ANTHROPIC_DOCS,
    docsLabel: 'Claude Code docs',
  },
  cursor: {
    headline: 'Install Cursor CLI',
    subscription: 'Cursor Pro subscription on cursor.com.',
    steps: [
      {
        title: 'Curl + bash installer',
        body: 'Cursor is not on npm. The official script downloads the right binary for your OS and drops it into `~/.local/bin` (or equivalent).',
      },
      {
        title: 'PATH check',
        body: 'After install, restart Goodboy if `cursor-agent` does not show up. Some shells need a new session before the new PATH takes effect.',
      },
      {
        title: 'Then sign in',
        body: 'Sign-in opens Cursor in your browser. You authorize once and the CLI keeps a long-lived token.',
      },
    ],
    docsUrl: CURSOR_DOCS,
    docsLabel: 'Cursor CLI docs',
  },
  codex: {
    headline: 'Install OpenAI Codex',
    subscription: 'ChatGPT Plus, Pro, or Business plan on chat.openai.com.',
    steps: [
      {
        title: 'npm global install',
        body: 'Pulls `@openai/codex` and exposes the `codex` command. Same caveat as Claude: global npm may need sudo without nvm.',
      },
      {
        title: 'Sign in with ChatGPT',
        body: 'After install you sign in once. Codex stores an OAuth token under `~/.codex/auth.json` and reuses it across sessions.',
      },
      {
        title: 'API-key alternative',
        body: 'If you prefer, you can skip sign-in and set OPENAI_API_KEY in your shell instead. Goodboy will still detect Codex as connected.',
      },
    ],
    docsUrl: CODEX_DOCS,
    docsLabel: 'Codex install guide',
  },
  gemini: {
    headline: 'Install Antigravity CLI',
    subscription: 'Google AI Pro plan, or a Gemini API key on the free tier.',
    steps: [
      {
        title: 'Curl installer',
        body: 'The official script downloads the `agy` binary for your OS and drops it into `~/.local/bin`. Antigravity is the successor to the Gemini CLI.',
      },
      {
        title: 'PATH check',
        body: 'After install, restart Goodboy if `agy` does not show up. Some shells need a new session before the new PATH takes effect.',
      },
      {
        title: 'Then connect it outside Goodboy',
        body: 'Antigravity ships no auth subcommand, so Goodboy cannot sign you in. Sign in from the Antigravity app, or set a Gemini API key as a credential.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Antigravity CLI docs',
  },
  opencode: {
    headline: 'Install OpenCode',
    subscription: 'OpenCode includes a curated set of zero-key models.',
    steps: [
      {
        title: 'npm global install',
        body: 'The installer adds the `opencode` command to your PATH.',
      },
      {
        title: 'Then sign in',
        body: 'Goodboy moves to the login step so you can connect an OpenCode account.',
      },
    ],
    docsUrl: OPENCODE_DOCS,
    docsLabel: 'OpenCode docs',
  },
};

const LOGIN_GUIDES: Partial<Record<ProviderId, ProviderGuide>> = {
  anthropic: {
    headline: 'Sign in to Claude',
    subscription: 'Your Claude Pro or Max account.',
    steps: [
      {
        title: 'Browser handoff',
        body: 'The CLI opens your default browser. Sign in with your Anthropic account and approve the CLI prompt.',
      },
      {
        title: 'You can close the browser',
        body: 'Once the approval page says "you can close this window", come back here. Goodboy detects the new token automatically.',
      },
    ],
    docsUrl: ANTHROPIC_DOCS,
    docsLabel: 'Claude Code sign-in',
  },
  cursor: {
    headline: 'Sign in to Cursor',
    subscription: 'Your Cursor Pro account.',
    steps: [
      {
        title: 'Browser handoff',
        body: 'A browser tab opens to cursor.com. Sign in and approve the CLI request.',
      },
      {
        title: 'Token is long-lived',
        body: 'After this you should not need to sign in again unless you log out manually.',
      },
    ],
    docsUrl: CURSOR_DOCS,
    docsLabel: 'Cursor CLI docs',
  },
  codex: {
    headline: 'Sign in to Codex',
    subscription: 'Your ChatGPT plan.',
    steps: [
      {
        title: 'Pick a method',
        body: 'Codex offers ChatGPT login or API key in the terminal menu. Click in the terminal and use the arrow keys to pick one.',
      },
      {
        title: 'ChatGPT flow opens the browser',
        body: 'If you pick ChatGPT, the browser opens. Sign in and approve. The credentials land in `~/.codex/auth.json`.',
      },
    ],
    docsUrl: CODEX_DOCS,
    docsLabel: 'Codex sign-in',
  },
  gemini: {
    headline: 'Connect Antigravity',
    subscription: 'Your Google account, or a Gemini API key.',
    steps: [
      {
        title: 'Sign in from the Antigravity app',
        body: '`agy` has no login command, so there is nothing Goodboy can run. The app writes the session to `~/.gemini/antigravity-cli/`, which Goodboy reads as ground truth.',
      },
      {
        title: 'API-key alternative',
        body: 'Prefer a key? Paste a Gemini API key instead and Goodboy stores it as GEMINI_API_KEY for `agy`. No browser round-trip.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Antigravity CLI auth',
  },
  opencode: {
    headline: 'Connect OpenCode',
    subscription: 'Your OpenCode account.',
    steps: [
      {
        title: 'Choose a provider',
        body: '`opencode auth login` opens an interactive provider login flow in the terminal.',
      },
      {
        title: 'Return when complete',
        body: 'Goodboy checks the OpenCode runtime again after the login process exits.',
      },
    ],
    docsUrl: OPENCODE_DOCS,
    docsLabel: 'OpenCode authentication',
  },
};

const LOGOUT_GUIDES: Partial<Record<ProviderId, ProviderGuide>> = {
  anthropic: {
    headline: 'Sign out of Claude',
    subscription: '',
    steps: [
      {
        title: 'Local-only',
        body: '`claude auth logout` clears the token from your machine. Your Anthropic account is untouched.',
      },
    ],
    docsUrl: ANTHROPIC_DOCS,
    docsLabel: 'Claude Code docs',
  },
  cursor: {
    headline: 'Sign out of Cursor',
    subscription: '',
    steps: [
      {
        title: 'Local-only',
        body: '`cursor-agent logout` removes the local token. Sign back in any time.',
      },
    ],
    docsUrl: CURSOR_DOCS,
    docsLabel: 'Cursor CLI docs',
  },
  codex: {
    headline: 'Sign out of Codex',
    subscription: '',
    steps: [
      {
        title: 'Local-only',
        body: '`codex logout` deletes `~/.codex/auth.json`. Your OpenAI plan stays intact.',
      },
    ],
    docsUrl: CODEX_DOCS,
    docsLabel: 'Codex docs',
  },
  gemini: {
    headline: 'Sign out of Antigravity',
    subscription: '',
    steps: [
      {
        title: 'Local-only',
        body: 'Goodboy removes `~/.gemini/antigravity-cli/`, the session state `agy` reads on startup. Your Google account stays intact.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Antigravity CLI docs',
  },
  opencode: {
    headline: 'Disconnect OpenCode',
    subscription: '',
    steps: [
      {
        title: 'Choose an account',
        body: '`opencode auth logout` removes the selected local provider credentials.',
      },
    ],
    docsUrl: OPENCODE_DOCS,
    docsLabel: 'OpenCode docs',
  },
};

const API_PROVIDER_GUIDE: ProviderGuide = {
  headline: 'Connect with an API key',
  subscription: 'Runs use the OpenCode runtime with your provider API key.',
  steps: [
    {
      title: 'Install the runtime',
      body: 'Install OpenCode first, then return to Provider Studio.',
    },
    {
      title: 'Add an API key',
      body: 'Paste a key in Provider Studio to link the provider.',
    },
  ],
  docsUrl: OPENROUTER_DOCS,
  docsLabel: 'OpenRouter docs',
};

export const guideFor = (
  providerId: ProviderId,
  action: ProviderLifecycleAction,
): ProviderGuide => {
  if (action === 'install') {
    return INSTALL_GUIDES[providerId] ?? API_PROVIDER_GUIDE;
  }
  if (action === 'login') {
    return LOGIN_GUIDES[providerId] ?? API_PROVIDER_GUIDE;
  }
  return LOGOUT_GUIDES[providerId] ?? API_PROVIDER_GUIDE;
};
