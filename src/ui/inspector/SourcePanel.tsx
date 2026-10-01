// A read-only CodeMirror 6 view of one element's source. This file and everything it imports from
// CodeMirror load in their own chunk, the first time the Source tab opens (see Inspector.tsx).
import { useEffect, useRef } from 'react';
import { Body1, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { MAX_FRAGMENT, type SourceFragment } from '../../app/source.ts';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  note: { padding: tokens.spacingHorizontalM, color: tokens.colorNeutralForeground3 },
  editor: { flex: 1, minHeight: 0, overflow: 'hidden' },
});

// Theme tokens, not hard-coded colors, so the editor follows light and dark with the rest of the app.
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: tokens.fontFamilyMonospace, lineHeight: '1.5' },
  '.cm-content': { padding: `${tokens.spacingVerticalS} 0` },
  '.cm-line': { padding: `0 ${tokens.spacingHorizontalM}` },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
});

const highlight = HighlightStyle.define([
  { tag: [tags.tagName, tags.propertyName], color: tokens.colorPaletteBerryForeground2 },
  { tag: tags.attributeName, color: tokens.colorPaletteMarigoldForeground2 },
  { tag: [tags.attributeValue, tags.string], color: tokens.colorPaletteGreenForeground2 },
  { tag: [tags.number, tags.bool, tags.null], color: tokens.colorPaletteBlueForeground2 },
  {
    tag: [tags.angleBracket, tags.punctuation, tags.brace, tags.squareBracket, tags.separator],
    color: tokens.colorNeutralForeground3,
  },
  { tag: [tags.comment, tags.meta], color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
]);

const languageFor = (language: SourceFragment['language']) => (language === 'xml' ? xml() : json());

/** Shows `source` read-only; the editor is created once and its content replaced as the selection moves. */
export default function SourcePanel({ source }: { source: SourceFragment | undefined }) {
  const styles = useStyles();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(undefined);
  const language = useRef(new Compartment());
  // The first content and language, for the effect that creates the editor; later changes are applied below.
  const initial = useRef(source);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current?.text ?? '',
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Source', 'aria-readonly': 'true' }),
          language.current.of(languageFor(initial.current?.language ?? 'xml')),
          syntaxHighlighting(highlight),
          theme,
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = undefined;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !source) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: source.text },
      effects: language.current.reconfigure(languageFor(source.language)),
      scrollIntoView: true,
    });
  }, [source]);

  return (
    <div className={styles.root}>
      {!source && <Body1 className={styles.note}>No source is available for this selection.</Body1>}
      {source?.truncated && (
        <Caption1 className={styles.note}>
          Showing the first {MAX_FRAGMENT.toLocaleString('en')} characters.
        </Caption1>
      )}
      {source?.language === 'json' && (
        <Caption1 className={styles.note}>
          Re-serialized from the parsed document: the content is exact, the formatting may differ.
        </Caption1>
      )}
      <div ref={host} className={styles.editor} hidden={!source} />
    </div>
  );
}
