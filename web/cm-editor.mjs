// A CodeMirror 6 editor for HLL source, with the inline controls of web/cm-controls.mjs. Made for the mix card's section
// pane first; the same factory is meant to take over the page's main source pane later. No history extension: the page
// keeps one undo stack for every way the source changes, and ctrl+z reaches its document-level handler from here.
import { EditorState, Annotation } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { hllControls, toggleControls } from './cm-controls.mjs';

const external = Annotation.define(); // a setText from outside: not an edit to report back

const dark = HighlightStyle.define([
  { tag: tags.string, color: '#c8e6a0' },
  { tag: tags.number, color: '#f0c674' },
  { tag: tags.propertyName, color: '#9fd3ff' },
  { tag: tags.keyword, color: '#d8a0ff' },
  { tag: [tags.comment, tags.lineComment], color: '#8a8a92', fontStyle: 'italic' },
  { tag: tags.bool, color: '#f0c674' },
]);
const theme = EditorView.theme({
  '&': { color: '#e8e8ea', backgroundColor: 'transparent' },
  '.cm-content': { font: 'var(--mono, 13px/1.45 ui-monospace, Consolas, Menlo, monospace)', caretColor: '#fff', padding: '.4rem 0' },
  '.cm-line': { padding: '0 .8rem' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff' },
  '.cm-matchingBracket': { backgroundColor: '#48484e', outline: 'none' },
}, { dark: true });

/**
 * createEditor({ parent, doc, schema, ui, onChange }) -> { view, text, setText(text), setControls(on) }.
 * onChange(text) fires for edits made in the editor (typing, a control, an alt-drag), not for setText.
 * ui: the host hooks the widgets may use (web/cm-widgets.mjs says which); none = native controls only.
 */
export function createEditor({ parent, doc = '', schema, ui, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        javascript(), syntaxHighlighting(dark), bracketMatching(), keymap.of([...defaultKeymap, indentWithTab]), EditorView.lineWrapping, theme,
        hllControls(schema, { ui }),
        EditorView.updateListener.of((u) => { if (u.docChanged && !u.transactions.some((t) => t.annotation(external))) onChange?.(u.state.doc.toString()); }),
      ],
    }),
  });
  return {
    view,
    get text() { return view.state.doc.toString(); },
    setText(text) { if (text !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: external.of(true) }); },
    setControls(on) { view.dispatch({ effects: toggleControls.of(!!on) }); },
  };
}
