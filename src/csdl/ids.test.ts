import { describe, expect, it } from 'vitest';
import {
  actionId,
  annotationId,
  childId,
  functionId,
  overloadGroupId,
  parameterId,
  qualify,
  returnTypeId,
} from './ids.ts';

const t = (name: string, isCollection = false) => ({ name, isCollection });

describe('target-path IDs', () => {
  it('builds type and child IDs', () => {
    expect(qualify('NS', 'Customer')).toBe('NS.Customer');
    expect(childId('NS.Customer', 'Orders')).toBe('NS.Customer/Orders');
    expect(childId('NS.Container', 'Customers')).toBe('NS.Container/Customers');
    expect(childId('NS.Color', 'Red')).toBe('NS.Color/Red');
  });

  it('distinguishes action overloads by binding type', () => {
    expect(actionId('NS.Reset', t('NS.Customer'))).toBe('NS.Reset(NS.Customer)');
    expect(actionId('NS.Reset', t('NS.Order', true))).toBe('NS.Reset(Collection(NS.Order))');
    expect(actionId('NS.Reset')).toBe('NS.Reset()');
  });

  it('lists every parameter type for function overloads', () => {
    expect(functionId('NS.GetTop', [t('NS.Customer')])).toBe('NS.GetTop(NS.Customer)');
    expect(functionId('NS.GetTop', [t('NS.Customer'), t('Edm.Int32')])).toBe(
      'NS.GetTop(NS.Customer,Edm.Int32)',
    );
    expect(functionId('NS.Now', [])).toBe('NS.Now()');
  });

  it('gives different overloads different IDs and the same group ID', () => {
    const a = functionId('NS.GetTop', [t('NS.Customer')]);
    const b = functionId('NS.GetTop', [t('NS.Customer'), t('Edm.Int32')]);
    expect(a).not.toBe(b);
    expect(overloadGroupId(a)).toBe('NS.GetTop');
    expect(overloadGroupId(b)).toBe('NS.GetTop');
    expect(overloadGroupId('NS.Customer')).toBe('NS.Customer');
  });

  it('builds parameter, return type and annotation IDs', () => {
    const op = functionId('NS.GetTop', [t('NS.Customer'), t('Edm.Int32')]);
    expect(parameterId(op, 'count')).toBe('NS.GetTop(NS.Customer,Edm.Int32)/count');
    expect(returnTypeId(op)).toBe('NS.GetTop(NS.Customer,Edm.Int32)/$ReturnType');
    expect(annotationId('NS.Customer/Name', 'Core.Description')).toBe(
      'NS.Customer/Name/@Core.Description',
    );
    expect(annotationId('NS.Customer', 'UI.Label', 'short')).toBe('NS.Customer/@UI.Label#short');
  });
});
