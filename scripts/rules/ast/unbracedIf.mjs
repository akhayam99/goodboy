import ts from 'typescript';
import { collect, lineOf } from './parse.mjs';

const isUnbraced = ({ node }) => {
  if (!ts.isIfStatement(node)) {
    return false;
  }
  if (!ts.isBlock(node.thenStatement)) {
    return true;
  }
  const other = node.elseStatement;
  return other !== undefined && !ts.isBlock(other) && !ts.isIfStatement(other);
};

export const unbracedIfLines = ({ file }) =>
  collect({ file, pick: (node) => (isUnbraced({ node }) ? lineOf({ node }) : undefined) });
