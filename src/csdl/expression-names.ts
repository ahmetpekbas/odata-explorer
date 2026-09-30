// Names of the annotation expression forms, shared by the XML and JSON parsers: an element name in
// XML, a `$Name` key in JSON.
import type { ConstantType, OperatorName, PathType } from './model.ts';

export const CONSTANTS: Record<string, ConstantType> = {
  Binary: 'binary',
  Bool: 'bool',
  Date: 'date',
  DateTimeOffset: 'dateTimeOffset',
  Decimal: 'decimal',
  Duration: 'duration',
  EnumMember: 'enumMember',
  Float: 'float',
  Guid: 'guid',
  Int: 'int',
  String: 'string',
  TimeOfDay: 'timeOfDay',
};

export const PATHS = new Set<string>([
  'Path',
  'AnnotationPath',
  'ModelElementPath',
  'NavigationPropertyPath',
  'PropertyPath',
] satisfies PathType[]);

export const OPERATORS = new Set<string>([
  'And',
  'Or',
  'Not',
  'Eq',
  'Ne',
  'Gt',
  'Ge',
  'Lt',
  'Le',
  'Has',
  'In',
  'Add',
  'Sub',
  'Neg',
  'Mul',
  'Div',
  'DivBy',
  'Mod',
] satisfies OperatorName[]);
