import type { AreaValue } from './areas';

type GuessAreaParams = {
  readonly text: string;
};

type AreaKeywords = {
  readonly area: Exclude<AreaValue, 'something-else'>;
  readonly keywords: ReadonlyArray<string>;
};

type AreaScore = {
  readonly area: Exclude<AreaValue, 'something-else'>;
  readonly count: number;
  readonly firstIndex: number;
};

const AREA_KEYWORDS = [
  {
    area: 'board-sessions',
    keywords: [
      'board',
      'session',
      'sessione',
      'sessioni',
      'stage',
      'lane',
      'kanban',
      'goal',
      'card',
    ],
  },
  {
    area: 'chat-agents',
    keywords: [
      'chat',
      'agent',
      'agente',
      'agenti',
      'transcript',
      'composer',
      'message',
      'messaggio',
      'turn',
    ],
  },
  {
    area: 'workflows-plans',
    keywords: [
      'workflow',
      'plan',
      'piano',
      'step',
      'preset',
      'orchestrator',
      'orchestratore',
      'autorun',
    ],
  },
  {
    area: 'diff-files-terminal',
    keywords: ['diff', 'file', 'terminal', 'terminale', 'worktree', 'editor', 'esplora'],
  },
  {
    area: 'reviews',
    keywords: ['pull request', 'pr', 'review', 'merge request', 'mr', 'merge'],
  },
  {
    area: 'integrations',
    keywords: [
      'integration',
      'integrazione',
      'integrazioni',
      'linear',
      'gitlab',
      'bitbucket',
      'slack',
      'jira',
      'sentry',
      'webhook',
      'issue',
    ],
  },
  {
    area: 'providers-models',
    keywords: [
      'provider',
      'model',
      'modello',
      'claude',
      'codex',
      'cursor',
      'opus',
      'sonnet',
      'gpt',
      'gemini',
      'antigravity',
      'opencode',
      'effort',
    ],
  },
  {
    area: 'budget-spend',
    keywords: ['budget', 'spend', 'cost', 'costo', 'spesa', 'price', 'prezzo', 'cap', 'usd'],
  },
  {
    area: 'permissions-scripts',
    keywords: ['permission', 'permesso', 'permessi', 'script', 'allowlist', 'sandbox'],
  },
  {
    area: 'notifications',
    keywords: ['notification', 'notifica', 'notifiche', 'toast', 'inbox'],
  },
  {
    area: 'phone-companion',
    keywords: ['phone', 'companion', 'mobile', 'telefono', 'qr'],
  },
  {
    area: 'settings-onboarding',
    keywords: [
      'settings',
      'impostazioni',
      'onboarding',
      'wizard',
      'setup',
      'guide',
      'guida',
      'theme',
      'tema',
    ],
  },
  {
    area: 'startup-updates-data',
    keywords: [
      'startup',
      'avvio',
      'launch',
      'update',
      'aggiornamento',
      'crash',
      'boot',
      'database',
      'migration',
    ],
  },
] satisfies ReadonlyArray<AreaKeywords>;

type KeywordIndexParams = {
  readonly text: string;
  readonly keyword: string;
};

const keywordIndex = ({ text, keyword }: KeywordIndexParams): number => {
  if (keyword.includes(' ')) {
    return text.indexOf(keyword);
  }
  return text.search(new RegExp(`\\b${keyword}\\b`));
};

type ScoreParams = {
  readonly text: string;
  readonly entry: AreaKeywords;
};

const scoreArea = ({ text, entry }: ScoreParams): AreaScore | null => {
  const indexes = entry.keywords
    .map((keyword) => keywordIndex({ text, keyword }))
    .filter((index) => index >= 0);
  if (indexes.length === 0) {
    return null;
  }
  return {
    area: entry.area,
    count: indexes.length,
    firstIndex: Math.min(...indexes),
  };
};

export const guessArea = ({ text }: GuessAreaParams): AreaValue | null => {
  const normalized = text.toLowerCase();
  const scores = AREA_KEYWORDS.map((entry) => scoreArea({ text: normalized, entry })).filter(
    (score): score is AreaScore => score != null,
  );
  scores.sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex);
  return scores[0]?.area ?? null;
};
