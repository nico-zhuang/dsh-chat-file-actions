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

test('registers file action and its own plugin-manager settings row, then disposes styles', () => {
  const dom = simpleDom();
  const client = loadClient(dom);
  const registrations = [];
  const forms = [];
  let styleDispose;
  const ctx = {
    remote: {}, get: () => undefined,
    configForms: { get: (namespace) => { forms.push(namespace); return { getSnapshot: () => ({ status: 'ready' }),
      subscribe: () => () => {} }; } },
    slots: {
      inject: (_name, callback) => { callback(); },
      register: (options, component) => { registrations.push({ options, component }); return () => {}; }
    },
    effect: (callback) => { styleDispose = callback(); }
  };
  client.apply(ctx);
  assert.deepEqual(forms, ['chat-file-actions']);
  const registration = registrations.find(({ options }) => options.name === 'conversation.chat.assistant-actions');
  assert.equal(registration.options.id, 'turn-files');
  assert.equal(registration.options.order, 70);
  assert.equal(registration.options.inject().form.getSnapshot().status, 'ready');
  assert.equal(typeof registration.component, 'function');
  const settings = registrations.find(({ options }) => options.name === 'plugins.row.config');
  assert.equal(settings.options.key, 'dsh-chat-file-actions#chat-file-actions');
  assert.equal(settings.component, client.SettingsPage);
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

test('only a whitespace-terminated closing fence ends a code block', () => {
  const dom = simpleDom();
  const { extractFileCandidates } = loadClient(dom);
  const files = extractFileCandidates([
    '```js\n[hidden](hidden.pdf)\n```javascript\n[still-hidden](still-hidden.pdf)\n```  \n[shown](shown.pdf)',
    '~~~~md\n@hidden.jpg\n~~~~ suffix\n@still-hidden.jpg\n~~~~\n@shown.jpg',
    '````md\n[hidden](hidden-again.pdf)\n```\n[still-hidden](still-hidden-again.pdf)\n````\n[shown](last.pdf)',
    '```md\r\n[hidden](windows-hidden.pdf)\r\n```\r\n[shown](windows-shown.pdf)'
  ]);
  assert.deepEqual(Array.from(files, ({ path }) => path), ['shown.pdf', 'shown.jpg', 'last.pdf', 'windows-shown.pdf']);
  dom.window.close();
});

test('Windows punctuation paths require unambiguous Markdown or @reference syntax', () => {
  const dom = simpleDom();
  const { extractFileCandidates, copyMarkdown } = loadClient(dom);
  const path = String.raw`C:\work\.env`;
  const encoded = copyMarkdown(path, '.env');
  const files = extractFileCandidates([
    String.raw`[ambiguous](<C:\work\.env>) [ambiguous](<C:\work\_draft.txt>)`,
    String.raw`@"C:\work\.env"`, encoded,
    String.raw`[forward](<C:/work/.env>) [web](<file:///C:/work/.env>)`
  ]);
  assert.deepEqual(Array.from(files, ({ path: filePath }) => filePath), [path]);
  assert.equal(extractFileCandidates([encoded])[0].path, path);
  assert.equal(extractFileCandidates([String.raw`[escaped](<C:\\work\\.env>)`])[0].path, path);
  assert.equal(extractFileCandidates(['[forward](<C:/work/.env>)'])[0].path, 'C:/work/.env');
  assert.equal(extractFileCandidates([String.raw`[mixed](<C:/work\.env>)`]).length, 0);
  assert.equal(extractFileCandidates([String.raw`[encoded-drive](<C:%5Cwork\.env>)`]).length, 0);
  assert.equal(extractFileCandidates([String.raw`[relative](<subdir\.env>)`]).length, 0);
  assert.equal(extractFileCandidates([String.raw`[dot-relative](<.\.env>)`]).length, 0);
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

test('settings normalize ordered copies and encode session-scoped sidebar addresses', () => {
  const dom = simpleDom();
  const { readSettings, sessionFileAddress } = loadClient(dom);
  assert.deepEqual(Array.from(readSettings(undefined).copyActions), ['path', 'name', 'markdown']);
  const settings = readSettings({ openMode: 'sidebar',
    copyActions: ['markdown', 'missing', 'path', 'markdown'] });
  assert.equal(settings.openMode, 'sidebar');
  assert.deepEqual(Array.from(settings.copyActions), ['markdown', 'path']);
  assert.equal(readSettings({ openMode: 'unknown', copyActions: [] }).openMode, 'system');
  assert.equal(sessionFileAddress('session A', '/work/a #1?.pdf'),
    'dsh-resource://file/session/session%20A//work/a%20%231%3F.pdf');
  assert.equal(sessionFileAddress('S', String.raw`C:\work\.env`),
    'dsh-resource://file/session/S/C:/work/.env');
  dom.window.close();
});

test('actual React slot hides without files and uses Host stat before native actions', async () => {
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
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /已请求系统打开文件/u);
    await act(async () => { firstRow.querySelector('.dtfa-icon[title="在文件管理器中显示"]').click(); });
    assert.equal(openCalls[1].path, '/workspace-A/deck.pptx');
    assert.equal(openCalls[1].action, 'reveal');
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /已请求系统定位文件/u);
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

test('plugin manager settings save an ordered subset and open mode with a revision fence', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const client = loadClient(dom);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const writes = [];
  const form = { state: { status: 'ready', writable: true, mode: 'host', revision: 7,
    value: { openMode: 'system', copyActions: ['path', 'name', 'markdown'] } },
    mutate: async (ops, revision) => { writes.push({ ops, revision }); return true; } };
  try {
    await act(async () => { root.render(React.createElement(client.SettingsPage, { view: 'page', form })); });
    assert.equal(dom.window.document.querySelectorAll('.dtfa-settings input[type="checkbox"]').length, 3);
    await act(async () => { dom.window.document.querySelector('input[value="sidebar"]').click(); });
    await act(async () => { dom.window.document.querySelectorAll('input[type="checkbox"]')[1].click(); });
    await act(async () => { dom.window.document.querySelector('[aria-label="上移复制链接"]').click(); });
    await act(async () => { dom.window.document.querySelector('.dtfa-settings-save').click(); });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].revision, 7);
    assert.deepEqual(JSON.parse(JSON.stringify(writes[0].ops.map(({ value }) => value))),
      ['sidebar', ['markdown', 'path']]);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /设置已保存/u);
    await act(async () => { root.render(React.createElement(client.SettingsPage, { view: 'summary', form })); });
    assert.match(dom.window.document.querySelector('#mount').textContent, /系统应用打开/u);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('side mode opens the verified file in the matching DSH session without native fallback', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const state = { status: 'ready', value: { openMode: 'sidebar', copyActions: ['markdown', 'path'] } };
  const form = { getSnapshot: () => state, subscribe: () => () => {} };
  const addresses = [];
  const native = [];
  let visibleSession = 'session-A';
  let sidebarAvailable = true;
  const sidebar = { mounted: { getSnapshot: () => visibleSession },
    openResource: (address) => { addresses.push(address); } };
  const remote = { workspaceFiles: { stat: async () => ({ ok: true,
    value: { absolutePath: '/work/report #1.pdf' } }) },
    session: { openWorkspacePath: async (request) => { native.push(request); return { ok: true }; } } };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote, form,
      getSidebarRight: () => sidebarAvailable ? sidebar : undefined,
      useChat: (selector) => selector(snapshotFor({ assistant: '[report](<docs/report%20%231.pdf>)' }))
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    const row = dom.window.document.querySelector('.dtfa-row');
    assert.match(row.querySelector('.dtfa-open').getAttribute('aria-label'), /在侧栏打开/u);
    await act(async () => { row.querySelector('.dtfa-open').click(); });
    assert.deepEqual(addresses, ['dsh-resource://file/session/session-A//work/report%20%231.pdf']);
    assert.equal(native.length, 0);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /已请求在 DSH 侧栏打开/u);
    await act(async () => { row.querySelector('[title="更多操作"]').click(); });
    assert.deepEqual([...row.querySelectorAll('.dtfa-more-action')].map((node) => node.textContent),
      ['用系统应用打开', '复制链接', '复制路径']);
    visibleSession = 'another-session';
    await act(async () => { row.querySelector('.dtfa-open').click(); });
    assert.equal(addresses.length, 1);
    assert.equal(native.length, 0);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /当前会话的 DSH 侧栏不可用/u);
    visibleSession = 'session-A';
    sidebarAvailable = false;
    await act(async () => { row.querySelector('.dtfa-open').click(); });
    assert.equal(addresses.length, 1);
    assert.equal(native.length, 0);
    await act(async () => { row.querySelector('.dtfa-more-action').click(); });
    assert.equal(native.length, 1);
    assert.equal(native[0].path, '/work/report #1.pdf');
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('empty copy menu disappears, but unreadable settings keep explicit system open', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const listeners = new Set();
  let state = { status: 'ready', value: { openMode: 'system', copyActions: [] } };
  const form = { getSnapshot: () => state, subscribe: (listener) => {
    listeners.add(listener); return () => listeners.delete(listener);
  } };
  const remote = { workspaceFiles: { stat: async () => ({ ok: true,
    value: { absolutePath: '/workspace/report.pdf' } }) }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote, form,
      useChat: (selector) => selector(snapshotFor({ assistant: '[report](report.pdf)' }))
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.equal(dom.window.document.querySelector('[title="更多操作"]'), null);
    state = { status: 'unavailable', value: { openMode: 'system', copyActions: [] } };
    await act(async () => { for (const listener of listeners) listener(); });
    assert.equal(dom.window.document.querySelector('.dtfa-open').disabled, true);
    await act(async () => { dom.window.document.querySelector('[title="更多操作"]').click(); });
    assert.deepEqual([...dom.window.document.querySelectorAll('.dtfa-more-action')].map((node) => node.textContent),
      ['用系统应用打开']);
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
    assert.match(rows[0].querySelector('.dtfa-open').getAttribute('aria-label'), /report\.pdf（\/workspace\/a）/u);
    assert.match(rows[1].querySelector('.dtfa-open').getAttribute('aria-label'), /report\.pdf（\/workspace\/b）/u);
    assert.equal(rows[2].querySelector('.dtfa-open').getAttribute('aria-label'), '打开 unique.jpg');
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
    client.apply({ remote, configForms: { get: () => ({}) }, slots: { inject: () => {} },
      effect: (effect) => { dispose = effect(); } });
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

test('Host may resolve relative files when client session snapshot has no cwd', async () => {
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
  const remote = { workspaceFiles: { stat: async (sessionId, path) => {
    statCalls.push([sessionId, path]);
    return { ok: true, value: { absolutePath: '/fallback/relative/report.pdf' } };
  } }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-no-cwd', remote,
      useChat: (selector) => selector(snapshotFor({ user: '@relative/report.pdf' })),
      useSessions: (selector) => selector({ byId: { 'session-no-cwd': {} } })
    })); });
    await act(async () => { dom.window.document.querySelector('[data-turn-files-button]').click(); });
    assert.deepEqual(statCalls, [['session-no-cwd', 'relative/report.pdf']]);
    assert.equal(dom.window.document.querySelector('.dtfa-open').disabled, false);
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
    await act(async () => { dom.window.document.querySelector('#mount').dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert.ok(dom.window.document.querySelector('[data-turn-files-panel]'));
    assert.equal(signal.aborted, false);
    await act(async () => { dom.window.document.querySelector('[data-turn-files-panel]').dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert.equal(signal.aborted, true);
    assert.equal(dom.window.document.querySelector('[data-turn-files-panel]'), null);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
  }
});

test('late stat from a closed panel never overwrites its reopened view', async () => {
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
  const pending = [];
  const signals = [];
  const remote = { workspaceFiles: { stat: async (_id, _path, signal) => {
    signals.push(signal);
    return new Promise((resolve) => pending.push(resolve));
  } }, session: {} };
  try {
    await act(async () => { root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote,
      useChat: (selector) => selector(snapshotFor({ assistant: '[one](one.jpg)' }))
    })); });
    const trigger = dom.window.document.querySelector('[data-turn-files-button]');
    await act(async () => { trigger.click(); });
    await act(async () => { trigger.click(); });
    assert.equal(signals[0].aborted, true);
    await act(async () => { trigger.click(); });
    assert.equal(pending.length, 2);
    await act(async () => { pending[0]({ ok: true, value: { absolutePath: '/old/one.jpg' } }); });
    assert.equal(dom.window.document.querySelector('.dtfa-open').disabled, true);
    await act(async () => { pending[1]({ ok: true, value: { absolutePath: '/new/one.jpg' } }); });
    assert.equal(dom.window.document.querySelector('.dtfa-open').disabled, false);
    assert.match(dom.window.document.querySelector('.dtfa-open').title, /\/new\/one\.jpg/u);
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
