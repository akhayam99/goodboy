import { describe, expect, it } from 'vitest';
import { isDefinition } from './definitionOf';

type Row = readonly [path: string, word: string, text: string, isExpected: boolean];

const ROWS: ReadonlyArray<Row> = [
  ['a.ts', 'creditKey', 'export const creditKey = 1;', true],
  ['a.ts', 'creditKey', '  let creditKey: number;', true],
  ['a.tsx', 'Ledger', 'export default function Ledger() {', true],
  ['a.ts', 'Ledger', 'export async function Ledger() {', true],
  ['a.ts', 'gen', 'function* gen() {', true],
  ['a.ts', 'Ledger', 'declare class Ledger {', true],
  ['a.ts', 'Entry', 'export interface Entry {', true],
  ['a.ts', 'Entry', 'type Entry = { id: string };', true],
  ['a.ts', 'Mode', 'export enum Mode {', true],
  ['a.js', 'old', 'var old = 1;', true],
  ['a.ts', 'creditKey', 'creditKey(account);', false],
  ['a.ts', 'creditKey', 'const total = creditKey(account);', false],
  ['a.ts', 'creditKey', 'const { creditKey } = options;', false],
  ['a.ts', 'creditKey', 'return creditKey;', false],
  ['a.ts', 'creditKey', 'const creditKeyed = 1;', false],
  ['a.ts', 'run', 'import { run } from "./run";', false],
  ['a.ts', 'run', '', false],
  ['a.ts', 'run', '   ', false],
  ['lib.rs', 'settle', 'pub fn settle(order: Order) {', true],
  ['lib.rs', 'settle', 'pub(crate) async fn settle() {', true],
  ['lib.rs', 'settle', 'const fn settle() -> u8 {', true],
  ['lib.rs', 'Order', 'pub struct Order {', true],
  ['lib.rs', 'Order', 'enum Order {', true],
  ['lib.rs', 'Payable', 'pub trait Payable {', true],
  ['lib.rs', 'LIMIT', 'pub const LIMIT: u32 = 3;', true],
  ['lib.rs', 'LIMIT', 'static LIMIT: u32 = 3;', true],
  ['lib.rs', 'ledger', 'mod ledger;', true],
  ['lib.rs', 'settle', 'settle(order);', false],
  ['lib.rs', 'settle', 'let done = settle(order);', false],
  ['ledger.py', 'settle', 'def settle(order):', true],
  ['ledger.py', 'settle', 'async def settle(order):', true],
  ['ledger.py', 'Order', 'class Order:', true],
  ['ledger.py', 'settle', 'settle(order)', false],
  ['ledger.go', 'Settle', 'func Settle(order Order) {', true],
  ['ledger.go', 'Order', 'type Order struct {', true],
  ['ledger.go', 'limit', 'var limit = 3', true],
  ['ledger.go', 'limit', 'const limit = 3', true],
  ['ledger.go', 'Settle', 'Settle(order)', false],
  ['ledger.rb', 'settle', 'def settle', false],
  ['README.md', 'settle', 'const settle = 1', false],
  ['Makefile', 'settle', 'const settle = 1', false],
];

describe('isDefinition', () => {
  it.each(ROWS)('%s %s %j is %s', (path, word, text, isExpected) => {
    expect(isDefinition({ path, word, text })).toBe(isExpected);
  });
});
