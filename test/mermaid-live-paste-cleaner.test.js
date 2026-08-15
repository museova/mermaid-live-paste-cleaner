const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const userscript = fs.readFileSync(
  path.join(__dirname, '..', 'mermaid-live-paste-cleaner.user.js'),
  'utf8'
);

class FakeDataTransfer {
  constructor() {
    this.data = new Map();
  }

  getData(type) {
    return this.data.get(type) || '';
  }

  setData(type, value) {
    this.data.set(type, value);
  }
}

class FakeClipboardEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.clipboardData = options.clipboardData || null;
    this.defaultPrevented = false;
    this.propagationStopped = false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

class FakeElement {
  constructor(className = '', parent = null) {
    this.className = className;
    this.parent = parent;
    this.isContentEditable = false;
    this.listeners = new Map();
  }

  closest(selector) {
    if (selector.includes('.monaco-editor')) {
      for (let current = this; current; current = current.parent) {
        if (current.className.includes('monaco-editor')) {
          return current;
        }
      }
    }

    return null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatchEvent(event) {
    for (const listener of this.windowListeners.get(event.type) || []) {
      listener(event);
    }

    if (!event.propagationStopped) {
      this.listeners.get(event.type)?.(event);
    }

    return !event.defaultPrevented;
  }
}

function createHarness() {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const fakeWindow = {
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    }
  };
  const fakeDocument = {
    activeElement: null,
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
    queryCommandSupported() {
      return false;
    }
  };

  const context = vm.createContext({
    ClipboardEvent: FakeClipboardEvent,
    DataTransfer: FakeDataTransfer,
    Element: FakeElement,
    HTMLInputElement: class FakeInputElement extends FakeElement {},
    HTMLTextAreaElement: class FakeTextAreaElement extends FakeElement {},
    InputEvent: class FakeInputEvent {},
    console,
    document: fakeDocument,
    window: fakeWindow
  });

  vm.runInContext(userscript, context);

  return { fakeDocument, fakeWindow, windowListeners };
}

function clipboardEvent(text) {
  const data = new FakeDataTransfer();
  data.setData('text/plain', text);
  return new FakeClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: data
  });
}

test('normalizes only complete Mermaid Markdown fences', () => {
  const { fakeWindow } = createHarness();
  const normalize = fakeWindow.__mermaidLivePasteCleaner.normalizeMermaidMarkdownPaste;

  assert.equal(normalize('```mermaid\nflowchart TD\n  A --> B\n```'), 'flowchart TD\n  A --> B');
  assert.equal(normalize('  ```MERMAID\r\nA --> B\r\n```  '), 'A --> B');
  assert.equal(normalize('```js\nA --> B\n```'), null);
  assert.equal(normalize('```mermaid\nA --> B'), null);
});

test('hands cleaned text back to Monaco through its paste handler', () => {
  const { fakeDocument, windowListeners } = createHarness();
  const editor = new FakeElement('monaco-editor');
  const input = new FakeElement('native-edit-context', editor);
  input.windowListeners = windowListeners;
  fakeDocument.activeElement = input;

  const pastedValues = [];
  input.addEventListener('paste', (event) => {
    pastedValues.push(event.clipboardData.getData('text/plain'));
    event.preventDefault();
  });

  const originalEvent = clipboardEvent('```mermaid\nflowchart TD\n  A --> B\n```');
  originalEvent.target = input;
  windowListeners.get('paste')[0](originalEvent);

  assert.equal(originalEvent.defaultPrevented, true);
  assert.equal(originalEvent.propagationStopped, true);
  assert.deepEqual(pastedValues, ['flowchart TD\n  A --> B']);
});
