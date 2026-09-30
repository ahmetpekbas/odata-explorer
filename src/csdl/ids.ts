// Target-path IDs. One scheme serves annotation targets, tab IDs, URL hashes and diagram nodes:
//   NS.Customer            schema child (type, term, container, ...)
//   NS.Customer/Orders     child of a type, container or enum
//   NS.Container/Customers
//   NS.Color/Red
//   NS.Fn(NS.Binding)      overload; see `actionId` and `functionId`
import type { TypeRef } from './model.ts';

type TypeName = Pick<TypeRef, 'name' | 'isCollection'>;

/** Reads `Collection(NS.Type)` and plain type references. */
export function typeRef(raw: string): TypeRef {
  const m = /^Collection\((.*)\)$/.exec(raw);
  return m
    ? { raw, name: m[1] ?? '', isCollection: true }
    : { raw, name: raw, isCollection: false };
}

export function qualify(namespace: string, name: string): string {
  return `${namespace}.${name}`;
}

/** ID of a child element: a property, navigation property, enum member, set, singleton or import. */
export function childId(parentId: string, name: string): string {
  return `${parentId}/${name}`;
}

/** Type reference as it appears in an overload signature, e.g. `Collection(NS.Order)`. */
export function typeRefString(type: TypeName): string {
  return type.isCollection ? `Collection(${type.name})` : type.name;
}

/**
 * Action overload: `NS.Act(BindingType)`, or `NS.Act()` for the unbound overload. Takes the
 * binding parameter type, if any.
 */
export function actionId(qualifiedName: string, bindingType?: TypeName): string {
  return `${qualifiedName}(${bindingType ? typeRefString(bindingType) : ''})`;
}

/** Function overload: `NS.Fn(Type1,Type2)`, listing every parameter type in declaration order. */
export function functionId(qualifiedName: string, parameterTypes: readonly TypeName[]): string {
  return `${qualifiedName}(${parameterTypes.map(typeRefString).join(',')})`;
}

/** ID of an action or function overload from its parameters, per `actionId` and `functionId`. */
export function operationId(
  kind: 'action' | 'function',
  qualifiedName: string,
  isBound: boolean,
  parameterTypes: readonly TypeName[],
): string {
  return kind === 'action'
    ? actionId(qualifiedName, isBound ? parameterTypes[0] : undefined)
    : functionId(qualifiedName, parameterTypes);
}

/** The overload ID without its signature, which names all overloads of an action or function. */
export function overloadGroupId(id: string): string {
  const paren = id.indexOf('(');
  return paren < 0 ? id : id.slice(0, paren);
}

export function parameterId(operationId: string, name: string): string {
  return childId(operationId, name);
}

export function returnTypeId(operationId: string): string {
  return childId(operationId, '$ReturnType');
}

/** ID of one annotation on a target: `Target/@Term#Qualifier`. */
export function annotationId(targetId: string, term: string, qualifier?: string): string {
  return `${targetId}/@${term}${qualifier ? `#${qualifier}` : ''}`;
}
