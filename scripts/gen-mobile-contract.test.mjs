import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildContract, lockVerdictOf, readLock } from './gen-mobile-contract.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'apps/desktop/src/features/companion/contract';
const STYLES = 'apps/desktop/src/styles.css';

const withCopy = ({ change }) => {
  const root = mkdtempSync(join(tmpdir(), 'gen-contract-'));
  try {
    mkdirSync(join(root, CONTRACT), { recursive: true });
    cpSync(join(ROOT, CONTRACT), join(root, CONTRACT), { recursive: true });
    mkdirSync(dirname(join(root, STYLES)), { recursive: true });
    cpSync(join(ROOT, STYLES), join(root, STYLES));
    change({ root });
    return buildContract({ root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const contract = buildContract();

describe('the mobile contract lock', () => {
  it('matches the committed contract and its version', () => {
    const verdict = lockVerdictOf({ lock: readLock(), contract });
    assert.equal(verdict.message, '');
    assert.equal(verdict.isOk, true);
  });

  it('fails when a type changes and the version does not', () => {
    const changed = withCopy({
      change: ({ root }) => {
        const path = join(root, CONTRACT, 'decisions.ts');
        writeFileSync(
          path,
          `${readFileSync(path, 'utf8')}\nexport type Added = { readonly x: string };\n`,
        );
      },
    });
    const verdict = lockVerdictOf({ lock: readLock(), contract: changed });
    assert.equal(verdict.isOk, false);
    assert.match(verdict.message, /bump it in contractVersion\.ts/);
  });

  it('fails when a token changes and the version does not', () => {
    const changed = withCopy({
      change: ({ root }) => {
        const path = join(root, STYLES);
        writeFileSync(
          path,
          readFileSync(path, 'utf8').replace(
            '--color-primary: oklch(0.785',
            '--color-primary: oklch(0.7',
          ),
        );
      },
    });
    assert.equal(lockVerdictOf({ lock: readLock(), contract: changed }).isOk, false);
  });

  it('fails when the version moves and the lock does not', () => {
    const changed = withCopy({
      change: ({ root }) => {
        writeFileSync(
          join(root, CONTRACT, 'contractVersion.ts'),
          'export const CONTRACT_VERSION = 99;\n',
        );
      },
    });
    const verdict = lockVerdictOf({ lock: readLock(), contract: changed });
    assert.equal(verdict.isOk, false);
    assert.match(verdict.message, /--lock/);
  });
});

describe('the generated Swift', () => {
  const swift = contract.files['Contract.generated.swift'];

  it('declares every action kind and every attention reason', () => {
    for (const kind of [
      'answerQuestion',
      'approvePlan',
      'requestPlanChanges',
      'answerPermission',
      'raiseLimit',
      'stopRun',
      'continueRun',
      'stopAgent',
      'continueAgent',
      'answerSlackReply',
      'mergePr',
      'startSession',
      'mergeTrain',
    ]) {
      assert.match(swift, new RegExp(`case ${kind}\\(`), kind);
    }
    for (const reason of ['agentError', 'pushFailed', 'slackReplyWaiting', 'runPausedAtLimit']) {
      assert.match(swift, new RegExp(`case ${reason} = `), reason);
    }
  });

  it('tags unions by kind and names the three start accesses', () => {
    assert.match(swift, /public enum MobileAction: Codable/);
    assert.match(
      swift,
      /public enum SessionAccess: String[^\n]*\n    case readOnly = "readOnly"\n    case askFirst = "askFirst"\n    case editsAllowed = "editsAllowed"\n\}/,
    );
  });

  it('names the three stops, the optional stops of a start and the task row facts', () => {
    assert.match(
      swift,
      /public enum StartStops: String[^\n]*\n    case everyStep = "everyStep"\n    case afterPlan = "afterPlan"\n    case never = "never"\n\}/,
    );
    assert.match(swift, /public let stops: StartStops\?/);
    assert.match(swift, /public let hasStops: Bool/);
    for (const field of ['description: String?', 'assignee: String?', 'stateLabel: String?']) {
      assert.ok(swift.includes(`public let ${field}`), field);
    }
  });

  it('pins the contract version at 8', () => {
    assert.equal(contract.version, 8);
  });

  it('carries the three projection fields on every projection', () => {
    for (const name of [
      'NeedsYouProjection',
      'SessionsProjection',
      'SessionProjection',
      'RunsProjection',
      'PullRequestProjection',
      'TasksProjection',
    ]) {
      const block = new RegExp(
        `public struct ${name}: [^{]*\\{([\\s\\S]*?)\\n    public init`,
      ).exec(swift);
      assert.notEqual(block, null, name);
      for (const field of ['epoch: Int', 'seq: Int', 'generatedAt: IsoTimestamp']) {
        assert.ok(block[1].includes(field), `${name} has ${field}`);
      }
    }
  });
});

describe('the token file', () => {
  const tokens = JSON.parse(contract.files['tokens.json']);

  it('holds every color token in dark and light', () => {
    const names = Object.keys(tokens.dark);
    assert.ok(names.length > 100);
    assert.deepEqual(Object.keys(tokens.light), names);
    for (const name of [
      'primary',
      'primary-wash',
      'primary-subtle',
      'primary-edge',
      'primary-solid',
      'on-primary',
    ]) {
      assert.ok(tokens.dark[name] !== undefined, name);
    }
  });

  it('keeps text warning and glyph warning apart in the light theme', () => {
    assert.notEqual(tokens.light.warning.css, tokens.light['warning-mark'].css);
  });

  it('resolves var references and the increased contrast overrides', () => {
    assert.equal(tokens.dark['on-primary'].css, tokens.dark['on-tone'].css);
    assert.equal(
      tokens.darkIncreasedContrast.idle.css,
      tokens.darkIncreasedContrast['faint-foreground'].css,
    );
    assert.notEqual(tokens.lightIncreasedContrast.idle.css, tokens.light.idle.css);
  });

  it('converts to sRGB in range', () => {
    for (const palette of [tokens.dark, tokens.light]) {
      for (const { srgb } of Object.values(palette)) {
        for (const channel of [srgb.red, srgb.green, srgb.blue, srgb.alpha]) {
          assert.ok(channel >= 0 && channel <= 1);
        }
      }
    }
    assert.deepEqual(tokens.dark.brand.srgb, { red: 0.0431, green: 0.0431, blue: 0.051, alpha: 1 });
  });
});
