import type { ProviderId } from './provider-registry';

export type ProviderLifecycleAction = 'install' | 'login' | 'logout';

export type ProviderPlatform = 'darwin' | 'linux' | 'win32';

export interface ProviderPlatformCommands {
  readonly darwin: string;
  readonly linux: string;
  readonly win32: string;
}

export interface ProviderLifecycleCommands {
  readonly install: ProviderPlatformCommands;
  readonly login: string;
  readonly logout: ProviderPlatformCommands;
}

// Cross-platform, npm-first. Cursor is the only non-npm exception because
// cursor-agent is not published on npm. Gemini logout has no subcommand so we
// remove the OAuth creds file directly (matches detect fallback in providers.rs).
export const PROVIDER_LIFECYCLE_COMMANDS: Record<ProviderId, ProviderLifecycleCommands> = {
  anthropic: {
    install: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
    },
    login: 'claude /login',
    logout: {
      darwin: 'claude /logout',
      linux: 'claude /logout',
      win32: 'claude /logout',
    },
  },
  cursor: {
    install: {
      darwin: 'curl https://cursor.com/install -fsS | bash',
      linux: 'curl https://cursor.com/install -fsS | bash',
      win32: 'powershell -Command "irm https://cursor.com/install.ps1 | iex"',
    },
    login: 'cursor-agent login',
    logout: {
      darwin: 'cursor-agent logout',
      linux: 'cursor-agent logout',
      win32: 'cursor-agent logout',
    },
  },
  codex: {
    install: {
      darwin: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
      win32: 'npm install -g @openai/codex',
    },
    login: 'codex login',
    logout: {
      darwin: 'codex logout',
      linux: 'codex logout',
      win32: 'codex logout',
    },
  },
  gemini: {
    install: {
      darwin: 'npm install -g @google/gemini-cli',
      linux: 'npm install -g @google/gemini-cli',
      win32: 'npm install -g @google/gemini-cli',
    },
    login: 'gemini',
    logout: {
      darwin: 'rm -f ~/.gemini/oauth_creds.json && echo "gemini credentials removed"',
      linux: 'rm -f ~/.gemini/oauth_creds.json && echo "gemini credentials removed"',
      win32:
        'del /f /q "%USERPROFILE%\\.gemini\\oauth_creds.json" 2>nul & echo gemini credentials removed',
    },
  },
};
