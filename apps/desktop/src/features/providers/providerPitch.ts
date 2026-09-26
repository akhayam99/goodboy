import type { ProviderId } from '@goodboy/types';

export type ProviderPitch = {
  readonly forWho: string;
  readonly needs: string;
};

export const PROVIDER_PITCH: Readonly<Record<ProviderId, ProviderPitch>> = {
  anthropic: {
    forWho: 'Best all-round coding agent.',
    needs: 'Needs a Claude Pro, Max or Team plan, or an API key.',
  },
  codex: {
    forWho: "OpenAI's coding agent.",
    needs: 'Needs ChatGPT Plus or Pro.',
  },
  cursor: {
    forWho: 'Uses your Cursor plan and its models.',
    needs: 'Needs a Cursor account.',
  },
  gemini: {
    forWho: "Google's models through Antigravity.",
    needs: 'A Google account in Antigravity, or a Gemini API key.',
  },
  opencode: {
    forWho: 'Open models, no account needed.',
    needs: 'Free models included.',
  },
  openrouter: {
    forWho: 'Many models behind one key.',
    needs: 'Needs an OpenRouter API key.',
  },
  moonshot: {
    forWho: "Moonshot's Kimi models.",
    needs: 'Needs a Moonshot API key.',
  },
};
