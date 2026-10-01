// A CodeMirror extension that makes qualified names clickable: a name the model defines, such as the
// `NS.Trip` in `Type="NS.Trip"`, opens that element's tab. Names are found in the visible lines only.
import type { Extension, Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { QUALIFIED_NAME, type LinkTarget } from '../../app/source-links.ts';
import type { ElementKind } from '../../csdl/model.ts';

export type ResolveName = (name: string) => LinkTarget | undefined;

function decorate(view: EditorView, resolveName: ResolveName): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = view.state.doc.lineAt(pos);
      for (const match of line.text.matchAll(QUALIFIED_NAME)) {
        const target = resolveName(match[0]);
        if (!target) continue;
        const start = line.from + match.index;
        ranges.push(
          Decoration.mark({
            class: 'cm-oe-link',
            attributes: {
              'data-link-id': target.id,
              'data-link-kind': target.kind,
              title: `Open ${target.id}`,
            },
          }).range(start, start + match[0].length),
        );
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(ranges, true);
}

/** `resolveName` is read on every update, so the resolver can change with the document. */
export function nameLinks(
  resolveName: () => ResolveName,
  open: (target: LinkTarget) => void,
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorate(view, resolveName());
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = decorate(update.view, resolveName());
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
  const clicks = EditorView.domEventHandlers({
    click(event) {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLElement>('.cm-oe-link') : null;
      const id = link?.dataset.linkId;
      const kind = link?.dataset.linkKind;
      // Dragging across a name selects it; only a plain click follows the link.
      if (!id || !kind || !(window.getSelection()?.isCollapsed ?? true)) return false;
      open({ id, kind: kind as ElementKind });
      return true;
    },
  });
  return [plugin, clicks];
}
