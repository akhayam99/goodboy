import ts from 'typescript';
import { collect, lineOf } from './parse.mjs';

const isDeclaredFunction = ({ node }) => {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.body !== undefined;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent);
  }
  return false;
};

const isFunctionValue = ({ node }) =>
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node);

const isFunctionSignature = ({ node }) =>
  ts.isFunctionTypeNode(node) ||
  ts.isMethodSignature(node) ||
  ts.isCallSignatureDeclaration(node) ||
  ts.isConstructorDeclaration(node);

const isInlineObjectType = ({ type }) => {
  if (ts.isTypeLiteralNode(type)) {
    return true;
  }
  if (ts.isIntersectionTypeNode(type)) {
    return type.types.some((member) => isInlineObjectType({ type: member }));
  }
  const [argument] = ts.isTypeReferenceNode(type) ? (type.typeArguments ?? []) : [];
  return (
    argument !== undefined &&
    ts.isTypeReferenceNode(type) &&
    type.typeName.getText() === 'Readonly' &&
    ts.isTypeLiteralNode(argument)
  );
};

const hasInlineObjectType = ({ parameter }) =>
  parameter.type !== undefined && isInlineObjectType({ type: parameter.type });

const isThisParameter = ({ parameter }) =>
  ts.isIdentifier(parameter.name) && parameter.name.text === 'this';

const isPositionalOrBare = ({ node, parameters }) => {
  if (!isDeclaredFunction({ node })) {
    return false;
  }
  if (parameters.length > 1) {
    return true;
  }
  const only = parameters[0];
  return only !== undefined && !ts.isObjectBindingPattern(only.name);
};

const isOffense = ({ node }) => {
  if (!isFunctionValue({ node }) && !isFunctionSignature({ node })) {
    return false;
  }
  const parameters = node.parameters.filter((parameter) => !isThisParameter({ parameter }));
  if (parameters.some((parameter) => hasInlineObjectType({ parameter }))) {
    return true;
  }
  return isFunctionValue({ node }) && isPositionalOrBare({ node, parameters });
};

export const paramShapeLines = ({ file }) =>
  collect({ file, pick: (node) => (isOffense({ node }) ? lineOf({ node }) : undefined) });
