import type { ProviderId } from './provider-registry'

export type ProviderLifecycleAction = 'install' | 'login' | 'logout'

export type ProviderPlatform = 'darwin' | 'linux' | 'win32'

export type ProviderPlatformCommands = {
  readonly darwin: string
  readonly linux: string
  readonly win32: string
}

export type ProviderLifecycleCommands = {
  readonly install: ProviderPlatformCommands
  readonly login: string
  readonly logout: string
}

export const PROVIDER_LIFECYCLE_COMMANDS: Record<ProviderId, ProviderLifecycleCommands> = {
  anthropic: {
    install: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
    },
    login: 'claude /login',
    logout: 'claude /logout',
  },
  cursor: {
    install: {
      darwin: 'curl https://cursor.com/install -fsS | bash',
      linux: 'curl https://cursor.com/install -fsS | bash',
      win32: 'powershell -Command "irm https://cursor.com/install.ps1 | iex"',
    },
    login: 'cursor-agent login',
    logout: 'cursor-agent logout',
  },
  codex: {
    install: {
      darwin: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
      win32: 'npm install -g @openai/codex',
    },
    login: 'codex login',
    logout: 'codex logout',
  },
  gemini: {
    install: {
      darwin: 'npm install -g @google/gemini-cli',
      linux: 'npm install -g @google/gemini-cli',
      win32: 'npm install -g @google/gemini-cli',
    },
    login: 'gemini',
    logout: 'rm -f ~/.gemini/oauth_creds.json && echo "gemini credentials removed"',
  },
}
