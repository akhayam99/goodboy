import { describe, expect, it } from 'vitest';
import { definitionOf } from './definitionOf';

type Row = readonly [path: string, word: string, text: string, expected: string | null];

const ROWS: ReadonlyArray<Row> = [
  ['ledger-core.ts', 'creditKey', 'export const creditKey = 1;', 'const'],
  ['ledger-core.ts', 'creditKey', '  let creditKey: number;', null],
  ['ledger-core.tsx', 'Ledger', 'export default function Ledger() {', 'function'],
  ['ledger-core.ts', 'Ledger', 'export async function Ledger() {', 'function'],
  ['ledger-core.ts', 'gen', 'function* gen() {', 'function'],
  ['ledger-core.ts', 'Ledger', 'declare class Ledger {', 'class'],
  ['ledger-core.ts', 'Entry', 'export interface Entry {', 'interface'],
  ['ledger-core.ts', 'Entry', 'type Entry = { id: string };', 'type'],
  ['ledger-core.ts', 'Mode', 'export enum Mode {', 'enum'],
  ['ledger-core.js', 'old', 'var old = 1;', null],
  ['ledger-core.ts', 'creditKey', 'creditKey(account);', null],
  ['ledger-core.ts', 'creditKey', 'const total = creditKey(account);', null],
  ['ledger-core.ts', 'creditKey', 'const { creditKey } = options;', null],
  ['ledger-core.ts', 'creditKey', 'return creditKey;', null],
  ['ledger-core.ts', 'creditKey', 'const creditKeyed = 1;', null],
  ['ledger-core.ts', 'run', 'import { run } from "./run";', null],
  ['ledger-core.ts', 'run', '', null],
  ['ledger-core.ts', 'run', '   ', null],
  ['ledger-core.rs', 'settle', 'pub fn settle(order: Order) {', 'function'],
  ['ledger-core.rs', 'settle', 'pub(crate) async fn settle() {', 'function'],
  ['ledger-core.rs', 'settle', 'const fn settle() -> u8 {', 'function'],
  ['ledger-core.rs', 'Order', 'pub struct Order {', 'struct'],
  ['ledger-core.rs', 'Order', 'enum Order {', 'enum'],
  ['ledger-core.rs', 'Payable', 'pub trait Payable {', 'trait'],
  ['ledger-core.rs', 'LIMIT', 'pub const LIMIT: u32 = 3;', 'const'],
  ['ledger-core.rs', 'LIMIT', 'static LIMIT: u32 = 3;', 'static'],
  ['ledger-core.rs', 'ledger', 'mod ledger;', null],
  ['ledger-core.rs', 'settle', 'settle(order);', null],
  ['ledger-core.rs', 'settle', 'let done = settle(order);', null],
  ['ledger-core.py', 'settle', 'def settle(order):', 'function'],
  ['ledger-core.py', 'settle', 'async def settle(order):', 'function'],
  ['ledger-core.py', 'Order', 'class Order:', 'class'],
  ['ledger-core.py', 'settle', 'settle(order)', null],
  ['ledger-core.go', 'Settle', 'func Settle(order Order) {', 'function'],
  ['ledger-core.go', 'Order', 'type Order struct {', 'type'],
  ['ledger-core.go', 'limit', 'var limit = 3', null],
  ['ledger-core.go', 'limit', 'const limit = 3', 'const'],
  ['ledger-core.go', 'Settle', 'Settle(order)', null],
  ['ledger-core.rb', 'settle', 'def settle', null],
  ['README.md', 'settle', 'const settle = 1', null],
  ['Makefile', 'settle', 'const settle = 1', null],
  ['node_modules/acme/ledger-core.ts', 'creditKey', 'export const creditKey = 1;', null],
  ['src/vendor/ledger-core.ts', 'creditKey', 'export const creditKey = 1;', null],
  ['pnpm-lock.yaml', 'creditKey', 'const creditKey = 1;', null],
  ['Cargo.lock', 'creditKey', 'const creditKey = 1;', null],
  ['ledger-core.ts', 'settle', '  public async settle(order: Order): Promise<void> {', 'method'],
  ['ledger-core.ts', 'settle', 'settle(order);', null],
  ['ledger-core.ts', 'settle', 'settle(order); const result = {', null],
  ['ledger-core.ts', 'settle', 'settle: (order: Order) => void;', null],
  ['ledger-core.tsx', 'maxWidth', '<Acme maxWidth={448} />', null],
  ['ledger-core.tsx', 'maxWidth', 'import { maxWidth } from "acme";', null],
  ['ledger-core.go', 'Settle', 'func (ledger *Ledger) Settle(order Order) {', 'method'],
  ['ledger-core.constructor', 'settle', 'const settle = 1;', null],
];

describe('definitionOf', () => {
  it.each(ROWS)('%s %s %j is %s', (path, word, text, expected) => {
    expect(definitionOf({ path, word, text })).toBe(expected);
  });
});
