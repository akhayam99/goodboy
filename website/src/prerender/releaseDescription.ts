const WANTED_LENGTH = 110;
const MIN_LENGTH = 70;
const MAX_LENGTH = 160;

type Params = {
  readonly version: string;
  readonly date: string;
  readonly summary: string;
  readonly notes: string;
};

type EntriesParams = {
  readonly notes: string;
};

type ClampParams = {
  readonly text: string;
};

const entriesOf = ({ notes }: EntriesParams) =>
  notes
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !/^[#|<]/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .trim(),
    )
    .filter((line) => line !== '');

const clamped = ({ text }: ClampParams) => {
  if (text.length <= MAX_LENGTH) {
    return text;
  }
  const cut = text.slice(0, MAX_LENGTH);
  const space = cut.lastIndexOf(' ');
  return cut.slice(0, space === -1 ? MAX_LENGTH : space).replace(/[ .,;:]+$/, '.');
};

export const releaseDescription = ({ version, date, summary, notes }: Params) => {
  const lead = `Goodboy ${version}:`;
  const parts = [lead, summary];
  entriesOf({ notes })
    .filter((entry) => entry !== summary)
    .forEach((entry) => {
      const isShort = parts.join(' ').length < WANTED_LENGTH;
      if (isShort && parts.join(' ').length + entry.length < MAX_LENGTH) {
        parts.push(entry);
      }
    });
  const text = parts.join(' ').trim();
  const padded =
    text.length < MIN_LENGTH
      ? `${text} Release notes for Goodboy ${version}, published ${date}, with every change in it.`
      : text;
  return clamped({ text: padded });
};
