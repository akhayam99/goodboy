import { detectSessionLanguage } from './detectSessionLanguage';
import { preferredLanguageName, type PreferredLanguage } from './preferredLanguages';
import { SESSION_LANGUAGE_NAMES } from './sessionLanguages';

export type SessionLanguageChoice =
  | { readonly kind: 'preferred'; readonly name: string }
  | { readonly kind: 'detected'; readonly name: string }
  | { readonly kind: 'open' };

type ResolveParams = {
  readonly preferred?: PreferredLanguage | null;
  readonly anchorText?: string;
};

export const resolveSessionLanguage = ({
  preferred = null,
  anchorText = '',
}: ResolveParams): SessionLanguageChoice => {
  if (preferred !== null) {
    return { kind: 'preferred', name: preferredLanguageName({ language: preferred }) };
  }
  const detected = detectSessionLanguage({ text: anchorText });
  if (detected === null) {
    return { kind: 'open' };
  }
  return { kind: 'detected', name: SESSION_LANGUAGE_NAMES[detected] };
};

type ComparedParams = {
  readonly preferred: PreferredLanguage | null;
  readonly text: string;
};

export const isInSessionLanguage = ({ preferred, text }: ComparedParams): boolean => {
  const written = detectSessionLanguage({ text });
  if (written === null || preferred === null) {
    return true;
  }
  return written === preferred;
};
