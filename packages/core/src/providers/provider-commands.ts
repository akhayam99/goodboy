import type { ProviderId, ProviderLifecycleCommands } from '@goodboy/types';

export const PROVIDER_LIFECYCLE_COMMANDS: Partial<Record<ProviderId, ProviderLifecycleCommands>> = {
  anthropic: {
    install: {
      darwin: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
      win32: 'npm install -g @anthropic-ai/claude-code',
    },
    update: {
      darwin: 'claude update',
      linux: 'claude update',
      win32: 'claude update',
    },
    login: 'claude auth login --claudeai',
    logout: 'claude auth logout',
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
    update: {
      darwin: 'npm install -g @openai/codex@latest',
      linux: 'npm install -g @openai/codex@latest',
      win32: 'npm install -g @openai/codex@latest',
    },
    login: 'codex login',
    logout: 'codex logout',
  },
  gemini: {
    install: {
      darwin: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      linux: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      win32: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    },
    logout: 'rm -rf ~/.gemini/antigravity-cli && echo "antigravity credentials removed"',
  },
  opencode: {
    install: {
      darwin: 'npm install -g opencode-ai',
      linux: 'npm install -g opencode-ai',
      win32: 'npm install -g opencode-ai',
    },
    update: {
      darwin: 'npm install -g opencode-ai@latest',
      linux: 'npm install -g opencode-ai@latest',
      win32: 'npm install -g opencode-ai@latest',
    },
    login: 'opencode auth login',
    logout: 'opencode auth logout',
  },
  openrouter: {
    install: {
      darwin: 'npm install -g opencode-ai',
      linux: 'npm install -g opencode-ai',
      win32: 'npm install -g opencode-ai',
    },
    update: {
      darwin: 'npm install -g opencode-ai@latest',
      linux: 'npm install -g opencode-ai@latest',
      win32: 'npm install -g opencode-ai@latest',
    },
    login: 'opencode auth login',
    logout: 'opencode auth logout',
  },
  moonshot: {
    install: {
      darwin: 'npm install -g opencode-ai',
      linux: 'npm install -g opencode-ai',
      win32: 'npm install -g opencode-ai',
    },
    update: {
      darwin: 'npm install -g opencode-ai@latest',
      linux: 'npm install -g opencode-ai@latest',
      win32: 'npm install -g opencode-ai@latest',
    },
    login: 'opencode auth login',
    logout: 'opencode auth logout',
  },
};
