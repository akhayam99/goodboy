export const SESSION_LANGUAGES = ['it', 'en', 'es', 'pt', 'fr', 'de'] as const;

export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

export const SESSION_LANGUAGE_NAMES = {
  it: 'Italian',
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
} as const satisfies Record<SessionLanguage, string>;
