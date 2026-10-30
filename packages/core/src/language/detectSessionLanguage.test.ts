import { describe, expect, it } from 'vitest';
import { detectSessionLanguage } from './detectSessionLanguage';

const detect = (text: string) => detectSessionLanguage({ text });

describe('detectSessionLanguage', () => {
  it('reads an Italian goal that mixes in English identifiers and commands', () => {
    expect(
      detect(
        'Sistema il layout delle pagine membro in harbor-portal, usa `MemberLayout` e controlla `pnpm typecheck`',
      ),
    ).toBe('it');
  });

  it('reads Portuguese', () => {
    expect(
      detect('Preciso que você corrija o layout das páginas de membros, mas não mude o login.'),
    ).toBe('pt');
  });

  it('reads Spanish', () => {
    expect(
      detect(
        'Necesito que arregles el diseño de las páginas de miembros, pero no cambies el acceso.',
      ),
    ).toBe('es');
  });

  it('reads English', () => {
    expect(
      detect('Fix the layout of the member pages and check that the build still passes.'),
    ).toBe('en');
  });

  it('reads French', () => {
    expect(
      detect('Corrige la mise en page des pages des membres, mais ne change pas la connexion.'),
    ).toBe('fr');
  });

  it('reads German', () => {
    expect(
      detect('Bitte behebe das Layout der Mitgliederseiten und ändere nicht die Anmeldung.'),
    ).toBe('de');
  });

  it('tells Portuguese from Spanish on the words only one of them uses', () => {
    expect(detect('Você também pode ver isso aqui, mas não está pronto ainda.')).toBe('pt');
    expect(detect('Usted también puede ver esto aquí, pero todavía no está listo.')).toBe('es');
  });

  it('tells Italian from Portuguese and Spanish on a short sentence', () => {
    expect(detect('Non so come fare questa cosa, dove sono i file?')).toBe('it');
    expect(detect('Não sei como fazer isso, onde estão os arquivos?')).toBe('pt');
    expect(detect('No sé cómo hacer esto, dónde están los archivos?')).toBe('es');
  });

  it('ignores fenced code, inline code, paths, urls and identifiers', () => {
    const text = [
      'Controlla che il pulsante sia nella pagina',
      '```ts',
      'const the = and + of;',
      '```',
      'src/features/the/and/of.ts https://acme.dev/the/and/of useTheAndOf the_and_of payments.the.and',
    ].join('\n');

    expect(detect(text)).toBe('it');
  });

  it('returns null for text that is too short', () => {
    expect(detect('Sistema il layout')).toBeNull();
    expect(detect('ok')).toBeNull();
    expect(detect('')).toBeNull();
  });

  it('returns null for code only text', () => {
    expect(detect('`pnpm typecheck` `MemberLayout` src/features/members/index.ts')).toBeNull();
    expect(detect('```ts\nconst the = and + of + with + from;\n```')).toBeNull();
  });

  it('returns null when fewer than two stopwords back the winner', () => {
    expect(detect('Rename MemberLayout across harbor-portal and ledger-core')).toBeNull();
    expect(detect('Refactor payments relay northwind cascadia harbor portal ledger')).toBeNull();
  });

  it('returns null when the winner is not clearly ahead', () => {
    expect(
      detect('the layout is bad, il layout non va bene, the page is bad, la pagina non va bene'),
    ).toBeNull();
    expect(detect('the layout is bad, il layout non va bene, the page is bad')).toBe('en');
  });

  it('returns null when stopwords are a thin share of a long text', () => {
    const filler = Array.from({ length: 30 }, () => 'widget').join(' ');

    expect(detect(`${filler} the page and`)).toBeNull();
  });

  it('accepts a text that sits just above the density floor', () => {
    const filler = Array.from({ length: 10 }, () => 'widget').join(' ');

    expect(detect(`${filler} the page and`)).toBe('en');
  });
});
