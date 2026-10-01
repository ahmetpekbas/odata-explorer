import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { selectActiveDocument, useStore } from '../../app/store.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { ElementView } from '../views/ElementView.tsx';
import { AnnotationsPanel } from './AnnotationsPanel.tsx';

const DOC = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:Reference Uri="core.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
<edmx:Reference Uri="cap.xml"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
<edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="T">
    <Key><PropertyRef Name="Id"/></Key>
    <Property Name="Id" Type="Edm.Int32"><Annotation Term="Core.Computed"/></Property>
    <Property Name="Name" Type="Edm.String">
      <Annotation Term="Core.Description" String="The name"/>
      <Annotation Term="Ex.Mine" Qualifier="q"><Record><PropertyValue Property="A" Int="1"/></Record></Annotation>
    </Property>
    <Property Name="Plain" Type="Edm.String"/>
  </EntityType>
  <EntityContainer Name="C"><EntitySet Name="Ts" EntityType="N.T"/></EntityContainer>
  <Annotations Target="N.T/Name"><Annotation Term="Core.LongDescription" String="From outside"/></Annotations>
  <Annotations Target="N.C/Ts">
    <Annotation Term="Capabilities.InsertRestrictions"><Record><PropertyValue Property="Insertable" Bool="false"/></Record></Annotation>
  </Annotations>
</Schema></edmx:DataServices></edmx:Edmx>`;

const resolved = loadResolved(DOC);
const initial = useStore.getInitialState();
beforeEach(() => {
  useStore.setState(initial, true);
  stubLayout();
});

const show = (id: string | undefined, mode: 'friendly' | 'technical' = 'friendly') =>
  renderView(<AnnotationsPanel resolved={resolved} id={id} mode={mode} />);

describe('annotations panel', () => {
  it('asks for a selection when there is none', () => {
    show(undefined);
    expect(screen.getByText('Select an element to see its annotations.')).toBeInTheDocument();
  });

  it('says so when the element has no annotations', () => {
    show('N.T/Plain');
    expect(screen.getByText('No annotations on this element.')).toBeInTheDocument();
  });

  it('groups by vocabulary and tells inline from external', () => {
    show('N.T/Name');
    const core = screen.getByRole('region', { name: 'Core' });
    expect(within(core).getByText('Description')).toBeInTheDocument();
    expect(within(core).getByText('The name')).toBeInTheDocument();
    expect(within(core).getByText('LongDescription')).toBeInTheDocument();
    expect(within(core).getByText('From outside')).toBeInTheDocument();
    expect(within(core).getAllByText('inline')).toHaveLength(1);
    expect(within(core).getAllByText('external')).toHaveLength(1);
    const own = screen.getByRole('region', { name: 'Ex' });
    expect(within(own).getByText('#q')).toBeInTheDocument();
  });

  it('shows a term without a summarizer as a value tree', () => {
    show('N.T/Name');
    const own = screen.getByRole('region', { name: 'Ex' });
    expect(within(own).getByText('A:')).toBeInTheDocument();
    expect(within(own).getByText('1')).toBeInTheDocument();
  });

  it('summarizes a known term, and adds the full term name and raw value in technical mode', () => {
    show('N.C/Ts');
    expect(screen.getByText('Entries cannot be created')).toBeInTheDocument();
    expect(screen.queryByText('Insertable:')).not.toBeInTheDocument();
  });

  it('shows the raw value as well in technical mode', () => {
    show('N.C/Ts', 'technical');
    expect(screen.getByText('Entries cannot be created')).toBeInTheDocument();
    expect(
      screen.getAllByText('Org.OData.Capabilities.V1.InsertRestrictions').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Insertable:')).toBeInTheDocument();
  });

  it('treats a bare annotation as true', () => {
    show('N.T/Id');
    expect(screen.getByText('Computed by the service')).toBeInTheDocument();
  });

  it('describes a term from the bundled vocabulary in its tooltip', async () => {
    show('N.T/Id');
    fireEvent.focus(screen.getByText('Computed'));
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(/generated on both insert/i),
    );
  });
});

describe('selecting a property', () => {
  it('shows its annotations, including external ones', async () => {
    useStore.getState().startLoading({ id: 'doc', name: 'doc.xml', size: DOC.length });
    useStore.getState().finishLoading('doc', resolved, DOC, []);
    useStore.getState().openTab({ id: 'N.T', kind: 'entityType' }, true);

    const Both = () => {
      const document = useStore(selectActiveDocument);
      const selection = useStore((s) => s.selection);
      if (document?.status !== 'ready') return null;
      return (
        <>
          <ElementView
            tab={{ id: 'N.T', kind: 'entityType', pinned: true }}
            resolved={document.resolved}
          />
          <AnnotationsPanel resolved={document.resolved} id={selection} mode="friendly" />
        </>
      );
    };
    renderView(<Both />);
    // Following the tab, the inspector shows the type itself.
    expect(screen.getByText('No annotations on this element.')).toBeInTheDocument();

    const row = within(screen.getByRole('table', { name: 'Properties' }))
      .getAllByRole('row')
      .find((r) => r.hasAttribute('aria-selected') && r.textContent?.includes('The name'));
    expect(row).toBeDefined();
    fireEvent.click(row as HTMLElement);

    await waitFor(() => expect(useStore.getState().selection).toBe('N.T/Name'));
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('From outside')).toBeInTheDocument();
    expect(screen.getByText('external')).toBeInTheDocument();
  });
});
