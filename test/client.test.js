import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React from 'react';

const code = fs.readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8');
const filename = fileURLToPath(new URL('../lib/client.js', import.meta.url));

function loadClient(dom, reactDom = { createPortal: (node) => node }) {
  let entry;
  vm.runInNewContext(code, {
    window: Object.assign(dom.window, { __ModuleLoader__: { load: (value) => { entry = value; } } }),
    document: dom.window.document,
    navigator: dom.window.navigator,
    AbortController,
    console
  }, { filename });
  assert.equal(entry.id, 'dsh-chat-file-actions');
  return entry.factory((id) => {
    if (id === 'react') return React;
    if (id === 'react-dom') return reactDom;
    if (id === '@deepseek-ai/dsh-client-ui-primitives') {
      const icon = (name) => () => React.createElement('svg', { 'data-dsh-icon': name });
      return { IconPaperclipOutlineRegular: icon('paperclip'),
        IconFolderOpenOutlineRegular: icon('folder-open'),
        IconEllipsisOutlineRegular: icon('ellipsis'),
        FileTypeIcon: icon('file-type') };
    }
    throw new Error(`unexpected bundled dependency: ${id}`);
  });
}

function snapshotFor({ user = '', assistant = '', messageId = 'answer', turn = 5, older = '' } = {}) {
  const nodes = new Map([
    ['u1', { kind: 'user', anchorSeq: 1, data: { content: [{ type: 'text', text: user }] } }],
    ['a1', { kind: 'assistant-step', anchorSeq: 3, data: { turn,
      finalNode: { messageId, seq: 3 }, blocks: [{ kind: 'text', text: assistant }] } }],
    ['u2', { kind: 'user', anchorSeq: 7, data: { content: [{ type: 'text', text: older }] } }],
    ['a2', { kind: 'assistant-step', anchorSeq: 8, data: { turn: 6,
      finalNode: { messageId: 'later', seq: 8 }, blocks: [{ kind: 'text', text: '[later](later.jpg)' }] } }]
  ]);
  return { nodes, locations: { getTurn: (key) => key === turn ? ['u1', 'a1'] : ['u2', 'a2'] } };
}

function simpleDom() {
  return new JSDOM('<!doctype html><html><head></head><body><main id="mount"></main></body></html>', {
    url: 'https://localhost:19387/'
  });
}

test('registers only the supported completed-reply action slot and disposes styles', () => {
  const dom = simpleDom();
  const client = loadClient(dom);
  let slotName;
  let registration;
  let styleDispose;
  const ctx = {
    remote: {},
    slots: {
      inject: (name, callback) => { slotName = name; callback(); },
      register: (options, component) => { registration = { options, component }; return () => {}; }
    },
    effect: (callback) => { styleDispose = callback(); }
  };
  client.apply(ctx);
  assert.equal(slotName, 'conversation.chat.assistant-actions');
  assert.equal(registration.options.id, 'turn-files');
  assert.equal(registration.options.order, 70);
  assert.equal(typeof registration.component, 'function');
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-css="dsh-chat-file-actions"]').length, 1);
  styleDispose();
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-css="dsh-chat-file-actions"]').length, 0);
  dom.window.close();
});

test('matches file links and @references while excluding code, URLs, folders and duplicates', () => {
  const dom = simpleDom();
  const { extractFileCandidates } = loadClient(dom);
  const files = extractFileCandidates([
    '![preview](<images/photo.jpg>) [slide](<decks/2026%20Q4.pptx#L5>)',
    '[pdf](docs/report.pdf) [web](https://example.test/a.pdf) [fragment](#intro)',
    'Use @"reports/annual report.pdf" and @src/file.jpg, not @folder/ or `@hidden.pdf`.',
    '```md\n[not-a-file](secret.pdf)\n``` [slide-again](<decks/2026%20Q4.pptx#L5>)'
  ]);
  assert.deepEqual(Array.from(files, ({ path }) => path), [
    'images/photo.jpg', 'decks/2026 Q4.pptx', 'docs/report.pdf',
    'reports/annual report.pdf', 'src/file.jpg'
  ]);
  dom.window.close();
});

test('excludes indented code and HTML comments, decodes escaped Markdown destinations', () => {
  const dom = simpleDom();
  const { extractFileCandidates } = loadClient(dom);
  const files = extractFileCandidates([
    `    [example](existing.pdf)
<!-- [hidden](existing.pdf) -->
[real](foo\\ bar.pdf)`,
    `<!-- open
@hidden.jpg
--> and @shown.jpg`
  ]);
  assert.deepEqual(Array.from(files, ({ path }) => path), ['foo bar.pdf', 'shown.jpg']);
  dom.window.close();
});

test('collects only the addressed answer and its own turn, not another conversation turn', () => {
  const dom = simpleDom();
  const { collectTurnTexts, extractFileCandidates } = loadClient(dom);
  const snapshot = snapshotFor({ user: '请看 @draft.pptx',
    assistant: '[成品](<output/summary.pdf>)', older: '@other.jpg' });
  assert.deepEqual(Array.from(extractFileCandidates(collectTurnTexts(snapshot, 'answer')), ({ path }) => path),
    ['draft.pptx', 'output/summary.pdf']);
  assert.equal(collectTurnTexts(snapshot, 'unknown').length, 0);
  dom.window.close();
});

test('copies escaped Markdown without confusing encoded filename characters', () => {
  const dom = simpleDom();
  const { copyMarkdown } = loadClient(dom);
  assert.equal(copyMarkdown('/local/a #b?.jpg', '图[一]'), '[图\\[一\\]](</local/a%20%23b%3F.jpg>)');
  dom.window.close();
});

test('actual React slot hides without files and uses session-scoped stat before Finder', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const statCalls = [];
  const openCalls = [];
  const copied = [];
  Object.defineProperty(dom.window.navigator, 'platform', { configurable: true, value: 'MacIntel' });
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true,
    value: { writeText: async (value) => { copied.push(value); } } });
  const remote = {
    workspaceFiles: { stat: async (sessionId, path, signal) => {
      statCalls.push({ sessionId, path, signal });
      return { ok: true, value: { absolutePath: `/workspace-A/${path}` } };
    } },
    session: { openWorkspacePath: async (request) => { openCalls.push(request); return { ok: true, value: { opened: true } }; } }
  };
  let snapshot = snapshotFor();
  const render = async () => act(async () => {
    root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote, useChat: (selector) => selector(snapshot),
      useSessions: (selector) => selector({ byId: { 'session-A': { cwd: '/workspace-A' } } })
    }));
  });
  try {
    await render();
    assert.equal(dom.window.document.querySelector('[data-turn-files-button]'), null);
    snapshot = snapshotFor({ user: '请看 @deck.pptx', assistant: '[图](<photos/one.jpg>)' });
    await render();
    assert.ok(dom.window.document.querySelector('[data-turn-files-button]'));
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.deepEqual(statCalls.map(({ sessionId, path }) => [sessionId, path]), [
      ['session-A', 'deck.pptx'], ['session-A', 'photos/one.jpg']
    ]);
    const firstRow = dom.window.document.querySelector('.dtfa-row');
    assert.equal(firstRow.querySelectorAll('.dtfa-icon').length, 2);
    assert.ok(dom.window.document.querySelector('[data-turn-files-button] svg[data-dsh-icon="paperclip"]'));
    await act(async () => { firstRow.querySelector('.dtfa-open').click(); });
    assert.equal(openCalls[0].path, '/workspace-A/deck.pptx');
    assert.equal(openCalls[0].action, undefined);
    await act(async () => { firstRow.querySelector('.dtfa-icon[title="在 Finder 中显示"]').click(); });
    assert.equal(openCalls[1].path, '/workspace-A/deck.pptx');
    assert.equal(openCalls[1].action, 'reveal');
    assert.equal(firstRow.querySelectorAll('.dtfa-more-action').length, 0);
    await act(async () => { firstRow.querySelector('.dtfa-icon[title="更多操作"]').click(); });
    assert.equal(firstRow.querySelectorAll('.dtfa-more-action').length, 3);
    await act(async () => { firstRow.querySelectorAll('.dtfa-more-action')[0].click(); });
    await act(async () => { firstRow.querySelectorAll('.dtfa-more-action')[1].click(); });
    await act(async () => { firstRow.querySelectorAll('.dtfa-more-action')[2].click(); });
    assert.equal(copied[0], '/workspace-A/deck.pptx');
    assert.equal(copied[1], 'deck.pptx');
    assert.match(copied[2], /^\[deck.pptx\]\(<\/workspace-A\/deck.pptx>\)$/u);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('identical filenames show their differing parents without showing long paths on every row', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const remote = { workspaceFiles: { stat: async (_id, path) => ({ ok: true,
    value: { absolutePath: `/workspace/${path}` } }) }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote,
      useChat: (selector) => selector(snapshotFor({ assistant:
        '[a](<a/report.pdf>) [b](<b/report.pdf>) [c](<c/unique.jpg>)' })),
      useSessions: (selector) => selector({ byId: { 'session-A': { cwd: '/workspace' } } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    const rows = [...dom.window.document.querySelectorAll('.dtfa-row')];
    assert.equal(rows.length, 3);
    assert.match(rows[0].querySelector('.dtfa-parent').textContent, /\/a$/u);
    assert.match(rows[1].querySelector('.dtfa-parent').textContent, /\/b$/u);
    assert.equal(rows[2].querySelector('.dtfa-parent'), null);
    assert.equal(rows[0].querySelector('.dtfa-name').textContent, 'report.pdf');
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('large file turns scroll inside the panel with at most six concurrent stat calls', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const links = Array.from({ length: 80 }, (_, i) => `[file](<dir/report-${i}.pdf>)`).join(' ');
  let active = 0;
  let peak = 0;
  let calls = 0;
  const remote = { workspaceFiles: { stat: async (_id, path) => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return { ok: true, value: { absolutePath: `/workspace/${path}` } };
  } }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote,
      useChat: (selector) => selector(snapshotFor({ assistant: links })),
      useSessions: (selector) => selector({ byId: { 'session-A': { cwd: '/workspace' } } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.equal(calls, 80);
    assert.ok(peak <= 6, `peak concurrency ${peak}`);
    assert.equal(dom.window.document.querySelectorAll('[role="listitem"]').length, 80);
    // CSS is installed by apply() in production; call it here to inspect scroll and theme rules.
    let dispose;
    client.apply({ remote, slots: { inject: () => {} }, effect: (effect) => { dispose = effect(); } });
    const styles = dom.window.document.querySelector('style[data-plugin-css="dsh-chat-file-actions"]').textContent;
    assert.match(styles, /\.dtfa-list\s*\{[^}]*overflow-y:auto/u);
    assert.match(styles, /--dsw-alias-bg-overlay/u);
    assert.match(styles, /--dsw-alias-border-l1/u);
    assert.match(styles, /prefers-color-scheme:dark/u);
    assert.match(styles, /\.dtfa-trigger svg\s*\{\s*width:17px/u);
    dispose();
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('extractor caps pathological turns at a documented 200 files', () => {
  const dom = simpleDom();
  const { extractFileCandidates } = loadClient(dom);
  const text = Array.from({ length: 240 }, (_, index) => `[file](<dir/${index}.pdf>)`).join(' ');
  assert.equal(extractFileCandidates([text]).length, 200);
  dom.window.close();
});

test('missing session cwd cannot resolve relative files or call the Host', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  let statCalls = 0;
  const remote = { workspaceFiles: { stat: async () => { statCalls++; return { ok: true }; } }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-no-cwd', remote,
      useChat: (selector) => selector(snapshotFor({ user: '@relative/report.pdf' })),
      useSessions: (selector) => selector({ byId: { 'session-no-cwd': {} } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.equal(statCalls, 0);
    assert.match(dom.window.document.querySelector('[data-turn-files-panel]').textContent, /无法确认本会话工作目录/);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('closing a file list aborts outstanding Host stat requests', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  let signal;
  const remote = { workspaceFiles: { stat: async (_id, _path, current) => {
    signal = current; return new Promise(() => {});
  } }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote,
      useChat: (selector) => selector(snapshotFor({ assistant: '[one](one.jpg)' })),
      useSessions: (selector) => selector({ byId: { 'session-A': { cwd: '/workspace-A' } } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.equal(signal.aborted, false);
    await act(async () => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true
    })); });
    assert.equal(signal.aborted, true);
    assert.equal(dom.window.document.querySelector('[data-turn-files-panel]'), null);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('bad file stat never enables native Open or Reveal', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  let nativeCalls = 0;
  const remote = { workspaceFiles: { stat: async () => ({ ok: false, error: { message: 'not found' } }) },
    session: { openWorkspacePath: async () => { nativeCalls++; return { ok: true }; } } };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-B', remote,
      useChat: (selector) => selector(snapshotFor({ assistant: '[missing](missing.pdf)' })),
      useSessions: (selector) => selector({ byId: { 'session-B': { cwd: '/workspace-B' } } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.match(dom.window.document.querySelector('[data-turn-files-panel]').textContent, /不可用/);
    assert.equal(dom.window.document.querySelectorAll('.dtfa-icon').length, 0);
    assert.equal(dom.window.document.querySelector('.dtfa-open').disabled, true);
    assert.equal(nativeCalls, 0);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});
