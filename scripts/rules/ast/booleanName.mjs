import ts from 'typescript';
import { BOOLEAN_NAME } from './booleanPrefixes.mjs';
import { collect, lineOf } from './parse.mjs';

const NULLISH = new Set([ts.SyntaxKind.NullKeyword, ts.SyntaxKind.UndefinedKeyword]);

const isNullishType = ({ type }) =>
  NULLISH.has(type.kind) || (ts.isLiteralTypeNode(type) && NULLISH.has(type.literal.kind));

const isBooleanType = ({ type }) => {
  if (type.kind === ts.SyntaxKind.BooleanKeyword) {
    return true;
  }
  if (ts.isParenthesizedTypeNode(type)) {
    return isBooleanType({ type: type.type });
  }
  if (!ts.isUnionTypeNode(type)) {
    return false;
  }
  const rest = type.types.filter((member) => !isNullishType({ type: member }));
  return rest.length > 0 && rest.every((member) => isBooleanType({ type: member }));
};

const isBooleanLiteral = ({ node }) =>
  node !== undefined &&
  (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword);

const isUseStateCall = ({ node }) =>
  node !== undefined &&
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'useState';

const isBooleanUseState = ({ node }) => {
  const [first] = node.arguments;
  const [typeArgument] = node.typeArguments ?? [];
  return (
    isBooleanLiteral({ node: first }) ||
    (typeArgument !== undefined && isBooleanType({ type: typeArgument }))
  );
};

const isBooleanDeclaration = ({ node }) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    if (node.type !== undefined) {
      return isBooleanType({ type: node.type });
    }
    return false;
  }
  if (ts.isParameter(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
    return (
      node.type !== undefined && ts.isIdentifier(node.name) && isBooleanType({ type: node.type })
    );
  }
  return false;
};

const nameOf = ({ node }) => (ts.isIdentifier(node.name) ? node.name.text : '');

const useStateName = ({ node }) => {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isArrayBindingPattern(node.name) ||
    !isUseStateCall({ node: node.initializer }) ||
    !isBooleanUseState({ node: node.initializer })
  ) {
    return undefined;
  }
  const [first] = node.name.elements;
  return first !== undefined && ts.isBindingElement(first) && ts.isIdentifier(first.name)
    ? first.name.text
    : undefined;
};

const offenseAt = ({ node }) => {
  const stateName = useStateName({ node });
  if (stateName !== undefined) {
    return BOOLEAN_NAME.test(stateName) ? undefined : lineOf({ node });
  }
  if (!isBooleanDeclaration({ node })) {
    return undefined;
  }
  return BOOLEAN_NAME.test(nameOf({ node })) ? undefined : lineOf({ node });
};

export const booleanNameLines = ({ file }) =>
  collect({ file, pick: (node) => offenseAt({ node }) });
