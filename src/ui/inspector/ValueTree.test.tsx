import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expressionTree } from '../../csdl/annotations.ts';
import { parseXml } from '../../csdl/parse-xml.ts';
import { resolve } from '../../csdl/resolve.ts';
import { coreOnly, expressionsXml } from '../../csdl/test-fixtures.ts';
import { renderView } from '../../test/views.tsx';
import { ValueTree } from './ValueTree.tsx';

const { elements } = resolve(parseXml(expressionsXml), expressionsXml, coreOnly);
const value = (term: string) => {
  const found = [...elements.values()]
    .flatMap((e) => e.annotations)
    .find((a) => a.term === `Ex.${term}`)?.value;
  if (!found) throw new Error(term);
  return found;
};

describe('ValueTree', () => {
  it('shows a record with its properties', () => {
    renderView(<ValueTree node={expressionTree(value('Record'))} />);
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Title:')).toBeInTheDocument();
    expect(screen.getByText("'Hello'")).toBeInTheDocument();
    expect(screen.getByText('Where:')).toBeInTheDocument();
  });

  it('nests the records of a collection', () => {
    renderView(<ValueTree node={expressionTree(value('Collection'))} />);
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1 + 3 + 1);
    expect(screen.getByText('P:')).toBeInTheDocument();
  });

  it('shows a plain value without a list', () => {
    renderView(<ValueTree node={expressionTree(value('Apply'))} />);
    expect(screen.getByText("concat('A', Name)")).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
