import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHARD_COUNT = 4;
const VITEST_NODE_ENTRY = 'vitest/node';

export const verifyShards = ({ all, shards }) => {
  const problems = [];
  const owners = new Map();
  shards.forEach((files, index) => {
    if (files.length === 0) problems.push(`shard ${index + 1} lists no test file`);
    for (const file of files) {
      owners.set(file, [...(owners.get(file) ?? []), index + 1]);
    }
  });
  const known = new Set(all);
  for (const file of all) {
    const listedIn = owners.get(file) ?? [];
    if (listedIn.length === 0) problems.push(`${file} is in no shard`);
    if (listedIn.length > 1) problems.push(`${file} is in shards ${listedIn.join(', ')}`);
  }
  for (const file of owners.keys()) {
    if (!known.has(file)) problems.push(`${file} is in a shard but not in the full list`);
  }
  return problems;
};

const loadVitest = ({ directory }) => {
  const require = createRequire(resolve(directory, 'package.json'));
  return import(pathToFileURL(require.resolve(VITEST_NODE_ENTRY)).href);
};

const listUnitFiles = async ({ directory, shard }) => {
  const { createVitest } = await loadVitest({ directory });
  const vitest = await createVitest('test', {
    root: directory,
    watch: false,
    project: ['unit'],
    shard: shard ? `${shard}/${SHARD_COUNT}` : undefined,
  });
  try {
    const specifications = await vitest.globTestSpecifications();
    if (!shard) return specifications.map((specification) => specification.moduleId);
    const Sequencer = vitest.config.sequence.sequencer;
    const selected = await new Sequencer(vitest).shard(specifications);
    return selected.map((specification) => specification.moduleId);
  } finally {
    await vitest.close();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'desktop');
  const all = await listUnitFiles({ directory, shard: null });
  const shards = [];
  for (let shard = 1; shard <= SHARD_COUNT; shard += 1) {
    shards.push(await listUnitFiles({ directory, shard }));
  }
  const problems = verifyShards({ all, shards });
  console.log(`unit files ${all.length}, shards ${shards.map((files) => files.length).join('/')}`);
  if (problems.length > 0) {
    for (const problem of problems.slice(0, 20)) console.error(problem);
    process.exit(1);
  }
}
