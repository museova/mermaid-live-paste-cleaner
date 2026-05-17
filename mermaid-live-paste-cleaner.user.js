// ==UserScript==
// @name         Mermaid Live Paste Cleaner
// @namespace    https://mermaid.live/
// @version      1.0.1
// @description  Strip Markdown ```mermaid fences when pasting into Mermaid Live Editor.
// @author       Codex
// @match        https://mermaid.live/*
// @homepageURL  https://github.com/museova/mermaid-live-paste-cleaner
// @supportURL   https://github.com/museova/mermaid-live-paste-cleaner/issues
// @updateURL    https://raw.githubusercontent.com/museova/mermaid-live-paste-cleaner/main/mermaid-live-paste-cleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/museova/mermaid-live-paste-cleaner/main/mermaid-live-paste-cleaner.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function normalizeMermaidMarkdownPaste(text) {
    if (typeof text !== 'string') {
      return null;
    }

    const outer = text.trim();
    const opening = outer.match(/^```[ \t]*mermaid[ \t]*(?:\r\n|\n)/i);
    const closing = outer.match(/(?:\r\n|\n)```[ \t]*$/);

    if (!opening || !closing || opening[0].length > outer.length - closing[0].length) {
      return null;
    }

    return outer.slice(opening[0].length, outer.length - closing[0].length);
  }

  function isEditableElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return !element.readOnly && !element.disabled;
    }

    if (element.isContentEditable) {
      return true;
    }

    return Boolean(
      element.closest('textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], .cm-editor, .cm-content, .monaco-editor')
    );
  }

  function shouldHandlePaste(event) {
    return isEditableElement(event.target) || isEditableElement(document.activeElement);
  }

  function insertIntoTextInput(element, text) {
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
      return false;
    }

    const start = typeof element.selectionStart === 'number' ? element.selectionStart : element.value.length;
    const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : start;
    element.setRangeText(text, start, end, 'end');
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      data: text,
      inputType: 'insertFromPaste'
    }));
    return true;
  }

  function insertIntoContentEditable(element, text) {
    const editable = element && element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]');
    if (!editable) {
      return false;
    }

    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
    editable.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      data: text,
      inputType: 'insertFromPaste'
    }));
    return true;
  }

  function insertCleanedText(text, event) {
    try {
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        if (document.execCommand('insertText', false, text)) {
          return true;
        }
      }
    } catch (error) {
      console.warn('[Mermaid Live Paste Cleaner] insertText command failed.', error);
    }

    const target = event.target instanceof Element ? event.target : document.activeElement;
    const active = document.activeElement instanceof Element ? document.activeElement : null;

    return insertIntoTextInput(target, text)
      || insertIntoTextInput(active, text)
      || insertIntoContentEditable(target, text)
      || insertIntoContentEditable(active, text);
  }

  function handlePaste(event) {
    if (event.defaultPrevented || !event.clipboardData || !shouldHandlePaste(event)) {
      return;
    }

    const cleanedText = normalizeMermaidMarkdownPaste(event.clipboardData.getData('text/plain'));
    if (cleanedText === null) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!insertCleanedText(cleanedText, event)) {
      console.warn('[Mermaid Live Paste Cleaner] Could not insert cleaned Mermaid text.');
    }
  }

  Object.defineProperty(window, '__mermaidLivePasteCleaner', {
    value: Object.freeze({
      normalizeMermaidMarkdownPaste
    }),
    configurable: true
  });

  window.addEventListener('paste', handlePaste, true);
  document.addEventListener('paste', handlePaste, true);
})();
