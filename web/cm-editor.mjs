// A CodeMirror 6 editor for HLL source, with the inline controls of web/cm-controls.mjs. Made for the mix card's section
// pane first; the same factory is meant to take over the page's main source pane later. No history extension: the page
// keeps one undo stack for every way the source changes, and ctrl+z reaches its document-level handler from here.
import { EditorState, Annotation } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { hllControls, toggleControls, languageFor } from './cm-controls.mjs';

const external = Annotation.define(); // a setText from outside: not an edit to report back

const dark = HighlightStyle.define([
  { tag: tags.string, color: '#c8e6a0' },
  { tag: tags.number, color: '#f0c674' },
  { tag: tags.propertyName, color: '#9fd3ff' },
  { tag: tags.keyword, color: '#d8a0ff' },
  { tag: [tags.comment, tags.lineComment], color: '#8a8a92', fontStyle: 'italic' },
  { tag: tags.bool, color: '#f0c674' },
]);
const font = { '.cm-content': { font: 'var(--mono, 13px/1.45 ui-monospace, Consolas, Menlo, monospace)', padding: '.4rem 0' }, '.cm-line': { padding: '0 .8rem' }, '&.cm-focused': { outline: 'none' }, '&': { backgroundColor: 'transparent' } };
const THEMES = {
  dark: [syntaxHighlighting(dark), EditorView.theme({ ...font, '&': { ...font['&'], color: '#e8e8ea' }, '.cm-content': { ...font['.cm-content'], caretColor: '#fff' }, '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff' }, '.cm-matchingBracket': { backgroundColor: '#48484e', outline: 'none' } }, { dark: true })],
  light: [syntaxHighlighting(defaultHighlightStyle), EditorView.theme(font)],
};

/**
 * createEditor({ parent, doc, schema, ui, root, light, onChange }) -> { view, text, setText(text), setControls(on) }.
 * onChange(text) fires for edits made in the editor (typing, a control, an alt-drag), not for setText.
 * ui: the host hooks the widgets may use (web/cm-widgets.mjs says which); none = native controls only.
 * root: the document is one expression, the object argument of this HLL call (the song header pane); default: a whole file.
 * light: the page's light look (the default is the rack's dark one).
 */
export function createEditor({ parent, doc = '', schema, ui, root = null, light = false, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        languageFor(root), bracketMatching(), keymap.of([...defaultKeymap.filter((b) => b.key !== 'Mod-Enter'), indentWithTab]), EditorView.lineWrapping, THEMES[light ? 'light' : 'dark'], // ctrl+enter is the page's Update, not a blank line
        hllControls(schema, { ui, root }),
        EditorView.updateListener.of((u) => { if (u.docChanged && !u.transactions.some((t) => t.annotation(external))) onChange?.(u.state.doc.toString()); }),
      ],
    }),
  });
  return {
    view,
    get text() { return view.state.doc.toString(); },
    setText(text) { // only the changed span, so a knob drag reparses one literal rather than the whole file
      const old = view.state.doc.toString();
      if (text === old) return;
      let a = 0; while (a < old.length && a < text.length && old[a] === text[a]) a++;
      let b = 0; while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) b++;
      view.dispatch({ changes: { from: a, to: old.length - b, insert: text.slice(a, text.length - b) }, annotations: external.of(true) });
    },
    setControls(on) { view.dispatch({ effects: toggleControls.of(!!on) }); },
  };
}
