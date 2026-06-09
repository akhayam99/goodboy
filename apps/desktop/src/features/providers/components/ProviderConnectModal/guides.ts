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
const GEMINI_DOCS = 'https://github.com/google-gemini/gemini-cli#installation';

const INSTALL_GUIDES: Record<ProviderId, ProviderGuide> = {
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
    headline: 'Install Gemini CLI',
    subscription: 'Google AI Pro plan, or any Google account on the free tier.',
    steps: [
      {
        title: 'npm global install',
        body: 'Fetches `@google/gemini-cli` and exposes the `gemini` command on your PATH. Node 20+ required.',
      },
      {
        title: 'Sign-in is interactive',
        body: 'Running `gemini` opens an interactive menu in the terminal where you pick the OAuth flow. Click in the terminal and use the arrow keys, the prompt accepts input directly.',
      },
      {
        title: 'Auth lives in a file',
        body: 'After login Gemini writes `~/.gemini/oauth_creds.json`. Goodboy reads that file to know you are connected, no subprocess polling needed.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Gemini CLI docs',
  },
};

const LOGIN_GUIDES: Record<ProviderId, ProviderGuide> = {
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
    headline: 'Sign in to Gemini',
    subscription: 'Your Google account (free or AI Pro).',
    steps: [
      {
        title: 'Pick the OAuth flow',
        body: 'Gemini drops you into an interactive menu. Click in the terminal and use the arrow keys to choose "Login with Google".',
      },
      {
        title: 'Browser handoff',
        body: 'Google opens in the browser. Sign in, grant the requested scopes, and Gemini writes the token to `~/.gemini/oauth_creds.json`.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Gemini CLI auth',
  },
};

const LOGOUT_GUIDES: Record<ProviderId, ProviderGuide> = {
  anthropic: {
    headline: 'Sign out of Claude',
    subscription: '',
    steps: [
      {
        title: 'Local-only',
        body: '`claude /logout` clears the token from your machine. Your Anthropic account is untouched.',
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
    headline: 'Sign out of Gemini',
    subscription: '',
    steps: [
      {
        title: 'File removal',
        body: 'Gemini has no `logout` subcommand. Goodboy removes `~/.gemini/oauth_creds.json` directly, which is what gemini reads on startup.',
      },
    ],
    docsUrl: GEMINI_DOCS,
    docsLabel: 'Gemini CLI docs',
  },
};

export const guideFor = (
  providerId: ProviderId,
  action: ProviderLifecycleAction,
): ProviderGuide => {
  if (action === 'install') return INSTALL_GUIDES[providerId];
  if (action === 'login') return LOGIN_GUIDES[providerId];
  return LOGOUT_GUIDES[providerId];
};
