import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";

const LANG_MAP = {
  js: javascript, jsx: () => javascript({ jsx: true }), ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }), mjs: javascript, cjs: javascript,
  py: python,
  json: json, jsonc: json,
  md: markdown,
  html: html, htm: html, vue: html, svelte: html,
  css: css, scss: css, less: css,
  xml: xml, svg: xml,
  sql: sql,
  yaml: yaml, yml: yaml,
};

function getLangExtension(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const factory = LANG_MAP[ext];
  if (!factory) return [];
  return [factory()];
}

function getLangName(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const names = {
    js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX", py: "Python",
    json: "JSON", md: "Markdown", html: "HTML", css: "CSS", xml: "XML", sql: "SQL",
    yaml: "YAML", yml: "YAML", sh: "Shell", bash: "Shell", go: "Go", rs: "Rust",
    toml: "TOML", vue: "Vue", svelte: "Svelte", svg: "SVG",
  };
  return names[ext] || ext.toUpperCase();
}

window._editorModule = {
  EditorView,
  EditorState,
  Compartment,
  basicSetup,
  oneDark,
  getLangExtension,
  getLangName,
  loaded: true,
};

window.dispatchEvent(new Event("editor-module-ready"));
