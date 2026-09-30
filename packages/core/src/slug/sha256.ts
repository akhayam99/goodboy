const WORD_RANGE = 4294967296;

const fractionalWord = (value: number): number =>
  Math.floor((value - Math.floor(value)) * WORD_RANGE);

const firstPrimes = (count: number): ReadonlyArray<number> => {
  const primes: number[] = [];
  for (let candidate = 2; primes.length < count; candidate += 1) {
    if (primes.every((prime) => candidate % prime !== 0)) {
      primes.push(candidate);
    }
  }
  return primes;
};

const PRIMES = firstPrimes(64);
const ROUND_CONSTANTS = Uint32Array.from(PRIMES, (prime) => fractionalWord(Math.cbrt(prime)));
const INITIAL_STATE = Uint32Array.from(PRIMES.slice(0, 8), (prime) =>
  fractionalWord(Math.sqrt(prime)),
);

const rotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

const wordAt = (words: Uint32Array, index: number): number => words[index] ?? 0;

const padMessage = (message: Uint8Array): Uint8Array => {
  const total = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = message.length * 8;
  view.setUint32(total - 8, Math.floor(bitLength / WORD_RANGE));
  view.setUint32(total - 4, bitLength >>> 0);
  return padded;
};

const compressBlock = (state: Uint32Array, block: DataView): void => {
  const schedule = new Uint32Array(64);
  for (let index = 0; index < 16; index += 1) {
    schedule[index] = block.getUint32(index * 4);
  }
  for (let index = 16; index < 64; index += 1) {
    const previous = wordAt(schedule, index - 15);
    const recent = wordAt(schedule, index - 2);
    const sigma0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3);
    const sigma1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ (recent >>> 10);
    schedule[index] = wordAt(schedule, index - 16) + sigma0 + wordAt(schedule, index - 7) + sigma1;
  }
  const working = Uint32Array.from(state);
  for (let index = 0; index < 64; index += 1) {
    const a = wordAt(working, 0);
    const e = wordAt(working, 4);
    const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const choice = (e & wordAt(working, 5)) ^ (~e & wordAt(working, 6));
    const first =
      wordAt(working, 7) + sum1 + choice + wordAt(ROUND_CONSTANTS, index) + wordAt(schedule, index);
    const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const majority =
      (a & wordAt(working, 1)) ^
      (a & wordAt(working, 2)) ^
      (wordAt(working, 1) & wordAt(working, 2));
    const second = sum0 + majority;
    working.copyWithin(1, 0, 7);
    working[4] = wordAt(working, 4) + first;
    working[0] = first + second;
  }
  for (let index = 0; index < 8; index += 1) {
    state[index] = wordAt(state, index) + wordAt(working, index);
  }
};

export const sha256Hex = (input: string): string => {
  const padded = padMessage(new TextEncoder().encode(input));
  const state = Uint32Array.from(INITIAL_STATE);
  for (let offset = 0; offset < padded.length; offset += 64) {
    compressBlock(state, new DataView(padded.buffer, offset, 64));
  }
  return Array.from(state, (word) => word.toString(16).padStart(8, '0')).join('');
};
