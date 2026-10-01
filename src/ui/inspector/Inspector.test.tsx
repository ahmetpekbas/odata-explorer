import { fireEvent, screen, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../../app/store.ts';
import trippin from '../../../fixtures/trippin.xml?raw';
import csdlJson from '../../../fixtures/csdl-schemas/csdl-16.1.json?raw';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { Inspector } from './Inspector.tsx';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  stubLayout();
});

const openSource = () => fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
const editor = () => screen.findByRole('textbox', { name: 'Source' });

describe('Inspector', () => {
  it('opens on the annotations of the selection', () => {
    renderView(
      <Inspector
        resolved={loadResolved(trippin)}
        text={trippin}
        id={`${NS}.Person`}
        mode="friendly"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Annotations', selected: true })).toBeInTheDocument();
    expect(screen.getByText(`${NS}.Person`)).toBeInTheDocument();
  });

  it('shows the source fragment of the selection, and follows it', async () => {
    const resolved = loadResolved(trippin);
    const { rerender } = renderView(
      <Inspector resolved={resolved} text={trippin} id={`${NS}.Airline`} mode="friendly" />,
    );
    openSource();
    expect(await editor()).toHaveTextContent('<EntityType Name="Airline"');
    expect(screen.queryByText(/Re-serialized/)).not.toBeInTheDocument();

    rerender(
      <FluentProvider theme={webLightTheme}>
        <Inspector
          resolved={resolved}
          text={trippin}
          id={`${NS}.Airline/AirlineCode`}
          mode="friendly"
        />
      </FluentProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Source' })).toHaveTextContent(
        /^<Property Name="AirlineCode"/,
      ),
    );
  });

  it('shows a JSON subtree and says it was re-serialized', async () => {
    const resolved = loadResolved(csdlJson);
    const type = resolved.model.schemas[0]?.entityTypes[0];
    renderView(<Inspector resolved={resolved} text={csdlJson} id={type?.id} mode="friendly" />);
    openSource();
    expect(await editor()).toHaveTextContent('"$Kind": "EntityType"');
    expect(screen.getByText(/Re-serialized from the parsed document/)).toBeInTheDocument();
  });

  it('says so when there is no source for the selection', async () => {
    renderView(
      <Inspector resolved={loadResolved(trippin)} text={trippin} id={undefined} mode="friendly" />,
    );
    openSource();
    expect(
      await screen.findByText('No source is available for this selection.'),
    ).toBeInTheDocument();
  });
});

describe('jump to definition', () => {
  const resolved = loadResolved(trippin);
  const links = async () => {
    await editor();
    return [...document.querySelectorAll<HTMLElement>('.cm-oe-link')];
  };

  it('links the qualified names the model defines, and no others', async () => {
    renderView(
      <Inspector resolved={resolved} text={trippin} id={`${NS}.Person`} mode="friendly" />,
    );
    openSource();
    const found = await links();
    const ids = new Set(found.map((l) => l.dataset.linkId));
    expect(ids).toContain(`${NS}.Trip`);
    expect(ids).toContain(`${NS}.PersonGender`);
    // `Edm.String` is not in the model, so it stays plain text.
    expect(found.some((l) => l.textContent?.startsWith('Edm.'))).toBe(false);
  });

  it('opens the element in a tab when its name is clicked', async () => {
    renderView(
      <Inspector resolved={resolved} text={trippin} id={`${NS}.Person`} mode="friendly" />,
    );
    openSource();
    const trip = (await links()).find((l) => l.dataset.linkId === `${NS}.Trip`);
    expect(trip).toBeDefined();
    fireEvent.click(trip as HTMLElement);
    expect(useStore.getState().activeTab).toBe(`${NS}.Trip`);
    expect(useStore.getState().tabs.map((t) => [t.id, t.kind])).toEqual([
      [`${NS}.Trip`, 'entityType'],
    ]);
  });
});
