export const PREFERRED_LANGUAGES = [
  { code: 'en', nativeName: 'English', name: 'English' },
  { code: 'it', nativeName: 'Italiano', name: 'Italian' },
  { code: 'es', nativeName: 'Español', name: 'Spanish' },
  { code: 'pt', nativeName: 'Português', name: 'Portuguese' },
  { code: 'fr', nativeName: 'Français', name: 'French' },
  { code: 'de', nativeName: 'Deutsch', name: 'German' },
  { code: 'nl', nativeName: 'Nederlands', name: 'Dutch' },
  { code: 'pl', nativeName: 'Polski', name: 'Polish' },
  { code: 'sv', nativeName: 'Svenska', name: 'Swedish' },
  { code: 'tr', nativeName: 'Türkçe', name: 'Turkish' },
  { code: 'ru', nativeName: 'Русский', name: 'Russian' },
  { code: 'uk', nativeName: 'Українська', name: 'Ukrainian' },
  { code: 'ar', nativeName: 'العربية', name: 'Arabic' },
  { code: 'hi', nativeName: 'हिन्दी', name: 'Hindi' },
  { code: 'zh', nativeName: '中文', name: 'Chinese' },
  { code: 'ja', nativeName: '日本語', name: 'Japanese' },
  { code: 'ko', nativeName: '한국어', name: 'Korean' },
] as const;

export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number]['code'];

type RawParams = { readonly raw: string | null | undefined };

export const parsePreferredLanguage = ({ raw }: RawParams): PreferredLanguage | null =>
  PREFERRED_LANGUAGES.find((language) => language.code === raw)?.code ?? null;

type NameParams = { readonly language: PreferredLanguage };

export const preferredLanguageName = ({ language }: NameParams): string =>
  PREFERRED_LANGUAGES.find((entry) => entry.code === language)?.name ?? language;
