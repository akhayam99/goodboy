type ModelUnavailableAction = 'enable_max_mode' | 'choose_supported_model';

type ModelUnavailablePattern = {
  readonly pattern: RegExp;
  readonly action: ModelUnavailableAction;
};

type ProviderErrorClassification =
  | { readonly kind: 'authentication' }
  | {
      readonly kind: 'model_not_available';
      readonly model: string;
      readonly action: ModelUnavailableAction;
    }
  | { readonly kind: 'other' };

type Params = {
  readonly message: string;
};

const AUTH_ERROR_PATTERNS = [
  /not authenticated/i,
  /not logged in/i,
  /auth required/i,
  /authentication required/i,
  /please log in/i,
  /please sign in/i,
  /unauthenticated/i,
  /\b401\b/,
  /unauthorized/i,
  /login required/i,
  /not signed in/i,
];

const MODEL_NOT_AVAILABLE_PATTERNS = [
  {
    pattern: /The model "([^"]+)" requires Max Mode to be enabled/i,
    action: 'enable_max_mode',
  },
  {
    pattern: /The '([^']+)' model is not supported when using Codex with a ChatGPT account/i,
    action: 'choose_supported_model',
  },
] satisfies ReadonlyArray<ModelUnavailablePattern>;

export const classifyProviderError = ({ message }: Params): ProviderErrorClassification => {
  if (AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return { kind: 'authentication' };
  }

  for (const entry of MODEL_NOT_AVAILABLE_PATTERNS) {
    const match = entry.pattern.exec(message);
    const model = match?.[1];
    if (model != null && model !== '') {
      return {
        kind: 'model_not_available',
        model,
        action: entry.action,
      };
    }
  }

  return { kind: 'other' };
};
