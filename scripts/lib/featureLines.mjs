import { plainTextOf, sentencesOf, wordsOf } from './docBudget.mjs';

export const MAX_LINE_WORDS = 25;

const BULLET = /^\*\*(.+?)\*\*: (.+)$/;
const AREA_BULLETS =
  /^## (.+)\n\n[\s\S]*?\n\n((?:- .+\n)+)\n\[More on .*?\]\(docs[/]features[/]([a-z-]+)\.md\)$/gm;
const SKIPPED_LINE = /^(?:<|\||$)/;
const NOT_PROSE = /^(?:#|[-*] |\d+\. )/;

export const bulletTitleOf = ({ bullet }) => BULLET.exec(bullet)?.[1] ?? bullet;

export const lineFor = ({ title, sentence }) => `**${title}**: ${sentence}`;

const plainSentenceOf = ({ text }) =>
  sentencesOf({ text: plainTextOf({ markdown: text }).replace(/`/g, '') })[0] ?? null;

export const firstSentenceOf = ({ body, title }) => {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line === `### ${title}`);
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,3} /.test(line));
  const section = end === -1 ? rest : rest.slice(0, end);
  const first = section.findIndex((line) => !SKIPPED_LINE.test(line.trimStart()));
  if (first === -1 || NOT_PROSE.test(section[first])) {
    return null;
  }
  const stop = section.findIndex((line, at) => at > first && line.trim() === '');
  const paragraph = section.slice(first, stop === -1 ? undefined : stop).join(' ');
  return plainSentenceOf({ text: paragraph });
};

export const areaBulletsOf = ({ index }) =>
  [...index.matchAll(AREA_BULLETS)].map((match) => ({
    block: match[2],
    slug: match[3],
    bullets: match[2]
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2)),
  }));

const problemFor = ({ title, sentence }) => {
  if (sentence === null) {
    return `${title}: the item has no first sentence, write one line of prose under its heading`;
  }
  const count = wordsOf({ text: sentence });
  return count > MAX_LINE_WORDS
    ? `${title}: the first sentence has ${count} words, ${MAX_LINE_WORDS} is the limit: ${sentence}`
    : null;
};

export const indexLinesOf = ({ index, docs }) =>
  areaBulletsOf({ index }).flatMap(({ slug, bullets }) =>
    bullets.map((bullet) => {
      const title = bulletTitleOf({ bullet });
      const sentence = firstSentenceOf({ body: docs.get(slug) ?? '', title });
      return { slug, title, bullet, sentence, problem: problemFor({ title, sentence }) };
    }),
  );

export const rewriteIndex = ({ index, docs }) =>
  indexLinesOf({ index, docs }).reduce(
    (text, { bullet, title, sentence }) =>
      sentence === null || bullet === lineFor({ title, sentence })
        ? text
        : text.replace(`\n- ${bullet}\n`, `\n- ${lineFor({ title, sentence })}\n`),
    index,
  );

export const mainCardsOf = ({ data }) =>
  data.clusters.flatMap((cluster) => cluster.items.filter((item) => item.main === true));

const sentenceOfTitle = ({ docs, title }) => {
  for (const body of docs.values()) {
    const sentence = firstSentenceOf({ body, title });
    if (sentence !== null) {
      return sentence;
    }
  }
  return null;
};

export const cardProblemsOf = ({ data, docs }) =>
  mainCardsOf({ data }).flatMap(({ title, text }) => {
    const sentence = sentenceOfTitle({ docs, title });
    const problem = problemFor({ title, sentence });
    if (problem !== null) {
      return [`site card ${problem}`];
    }
    return text === sentence
      ? []
      : [`site card ${title}: the text differs from the first sentence of its item`];
  });

const escapeJson = ({ value }) => JSON.stringify(value);

export const rewriteCards = ({ raw, data, docs }) =>
  mainCardsOf({ data }).reduce((text, { title, text: current }) => {
    const sentence = sentenceOfTitle({ docs, title });
    if (sentence === null || sentence === current) {
      return text;
    }
    const pattern = new RegExp(
      `("title": ${escapeJson({ value: title }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*"text": )"(?:[^"\\\\]|\\\\.)*"`,
    );
    return text.replace(pattern, (_, head) => `${head}${escapeJson({ value: sentence })}`);
  }, raw);

export const indexProblemsOf = ({ index, docs }) =>
  indexLinesOf({ index, docs }).flatMap(({ title, bullet, sentence, problem }) => {
    if (problem !== null) {
      return [`FEATURES.md ${problem}`];
    }
    return bullet === lineFor({ title, sentence })
      ? []
      : [`FEATURES.md ${title}: the line differs from the first sentence of its item`];
  });
