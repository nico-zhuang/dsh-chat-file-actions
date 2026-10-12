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

function snapshotFor({ user = '', assistant = '', messageId = 'answer', turn = 5, older = '', tools = [] } = {}) {
  const nodes = new Map([
    ['u1', { kind: 'user', anchorSeq: 1, data: { content: [{ type: 'text', text: user }] } }],
    ['a1', { kind: 'assistant-step', anchorSeq: 3, data: { turn,
      finalNode: { messageId, seq: 3 }, blocks: [{ kind: 'text', text: assistant }] } }],
    ['u2', { kind: 'user', anchorSeq: 7, data: { content: [{ type: 'text', text: older }] } }],
    ['a2', { kind: 'assistant-step', anchorSeq: 8, data: { turn: 6,
      finalNode: { messageId: 'later', seq: 8 }, blocks: [{ kind: 'text', text: '[later](later.jpg)' }] } }]
  ]);
  const toolKeys = tools.map((tool, index) => {
    const key = `tool${index}`;
    nodes.set(key, { kind: 'tool-call', anchorSeq: tool.anchorSeq ?? 2,
      visibility: tool.visibility, data: { root: tool.root } });
    return key;
  });
  return { nodes, locations: { getTurn: (key) => key === turn ? ['u1', ...toolKeys, 'a1'] : ['u2', 'a2'] } };
}

function editedTool(path, overrides = {}) {
  return { root: { kind: 'tool-result', seq: 2, isError: false,
    call: { name: 'edit', argsRaw: JSON.stringify({ file_path: path }) },
    meta: { diffs: [{ path, oldText: 'old', newText: 'new' }] }, ...overrides } };
}

function createdTool(path) {
  return editedTool(path, { call: { name: 'write', argsRaw: JSON.stringify({ file_path: path }) },
    meta: { operation: 'create', diffs: [] } });
}

function simpleDom() {
  return new JSDOM('<!doctype html><html><head></head><body><main id="mount"></main></body></html>', {
    url: 'https://localhost:19387/'
  });
}

function localeFace(initial = 'zh') {
  let snapshot = { active: initial, revision: 1 };
  let registered = null;
  const listeners = new Set();
  const announce = () => { snapshot = { ...snapshot, revision: snapshot.revision + 1 };
    for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    register: (ns, dictionaries) => {
      assert.equal(ns, 'dsh-chat-file-actions');
      assert.deepEqual(Object.keys(dictionaries).sort(), ['en', 'zh']);
      registered = dictionaries;
      announce();
      return () => { registered = null; announce(); };
    },
    bind: (ns) => {
      assert.equal(ns, 'dsh-chat-file-actions');
      return (key, params) => {
        const text = registered?.[snapshot.active]?.[key] || registered?.en?.[key] || key;
        return text.replace(/\{(\w+)\}/gu, (match, name) => name in (params || {}) ?
          String(params[name]) : match);
      };
    },
    setLocale: (active) => { snapshot = { ...snapshot, active }; announce(); },
    registered: () => registered
  };
}

function installLocale(client, locale) {
  const disposers = [];
  client.apply({ locale, remote: {}, configForms: { get: () => ({}) },
    slots: { inject: () => {} }, effect: (callback) => { disposers.push(callback()); } });
  return () => { for (const dispose of disposers.reverse()) dispose(); };
}

test('registers file action and its own plugin-manager settings row, then disposes styles', () => {
  const dom = simpleDom();
  const client = loadClient(dom);
  const registrations = [];
  const forms = [];
  const disposers = [];
  const locale = localeFace();
  const ctx = {
    remote: {}, locale, get: () => undefined,
    configForms: { get: (namespace) => { forms.push(namespace); return { getSnapshot: () => ({ status: 'ready' }),
      subscribe: () => () => {} }; } },
    slots: {
      inject: (_name, callback) => { callback(); },
      register: (options, component) => { registrations.push({ options, component }); return () => {}; }
    },
    effect: (callback) => { disposers.push(callback()); }
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
  assert.equal(typeof settings.component, 'function');
  assert.equal(settings.component({ view: 'summary', form: {} }).props.locale, locale);
  assert.equal(registration.options.inject().locale, locale);
  assert.equal(locale.registered().en.settingsSaved, 'Settings saved');
  assert.equal(locale.registered().zh.settingsSaved, '设置已保存');
  assert.deepEqual(Object.keys(locale.registered().zh).sort(), Object.keys(locale.registered().en).sort());
  for (const key of Object.keys(locale.registered().zh)) {
    const variables = (value) => [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
    assert.deepEqual(variables(locale.registered().zh[key]), variables(locale.registered().en[key]), key);
  }
  assert.ok(client.inject.includes('locale'));
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-css="dsh-chat-file-actions"]').length, 1);
  for (const dispose of disposers.reverse()) dispose();
  assert.equal(locale.registered(), null);
  assert.equal(dom.window.document.querySelectorAll('style[data-plugin-css="dsh-chat-file-actions"]').length, 0);
  dom.window.close();
});

test('package exports localized plugin-manager metadata for both DSH languages', () => {
  const manifest = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(manifest.exports['./package.json'], './package.json');
  assert.equal(manifest.exports['./locale/*.json'], './locale/*.json');
  assert.ok(manifest.files.includes('locale'));
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'));
  for (const language of ['zh', 'en']) {
    const locale = JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../locale/${language}.json`, import.meta.url)), 'utf8'));
    assert.equal(typeof locale.meta.title, 'string');
    assert.equal(typeof locale.meta.description, 'string');
    assert.ok(locale.meta.title.length > 0 && locale.meta.description.length > 0);
  }
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

test('escaped and unmatched backticks do not hide subsequent real links', () => {
  const dom = simpleDom();
  const { extractFileCandidates } = loadClient(dom);
  const files = extractFileCandidates([
    'Escaped \\` and [report](report.pdf)',
    'Unclosed ` and [summary](summary.pdf)',
    '`[hidden](hidden.pdf)` [visible](visible.pdf)'
  ]);
  assert.deepEqual(Array.from(files, ({ path }) => path),
    ['report.pdf', 'summary.pdf', 'visible.pdf']);
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

test('keeps explicit web links and local files in one ordered, deduped turn list', () => {
  const dom = simpleDom();
  const { extractTurnCandidates, copyWebMarkdown, webDestination } = loadClient(dom);
  const candidates = extractTurnCandidates([
    { type: 'text', text: '[Release](https://GitHub.com/nico/releases) [README](README.md) ' +
      '[package](https://github.com/nico/pkg.tgz?download=1#asset) ' +
      '[again](https://github.com/nico/releases) `[_ignored](https://evil.test)`' },
    { type: 'edited-file', path: 'README.md' }
  ]);
  assert.deepEqual(Array.from(candidates, (item) => [item.type, item.path || item.url]), [
    ['web', 'https://github.com/nico/releases'], ['file', 'README.md'],
    ['web', 'https://github.com/nico/pkg.tgz?download=1#asset']
  ]);
  assert.equal(candidates[1].edited, true);
  assert.equal(candidates[0].host, 'github.com');
  assert.equal(copyWebMarkdown(candidates[2].url, '文件[包]'),
    '[文件\\[包\\]](<https://github.com/nico/pkg.tgz?download=1#asset>)');
  assert.equal(webDestination('HTTPS://Example.test/a')?.url, 'https://example.test/a');
  const balanced = extractTurnCandidates([{ type: 'text', text:
    '[React](https://en.wikipedia.org/wiki/React_(software)) ' +
    '[report [PDF]](https://example.org/report) \\[escaped](https://ignore.example) ' +
    '[broken [inner](https://example.org/inner)' }]);
  assert.deepEqual(Array.from(balanced, (item) => [item.name, item.url]), [
    ['React', 'https://en.wikipedia.org/wiki/React_(software)'],
    ['report [PDF]', 'https://example.org/report'],
    ['inner', 'https://example.org/inner']
  ]);
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', '//evil.test/a',
    'https://user:pass@example.test/a', String.raw`https://example.test\\@evil.test/a`,
    'https://example.test/ with-space', 'https://example.test/\nnext',
    'https://example.test/<bad>']) assert.equal(webDestination(bad), null, bad);
  assert.deepEqual(Array.from(extractTurnCandidates([
    { type: 'text', text: '[javascript](javascript:alert(1)) [plain](https://example.test) ' +
      'https://unlinked.test [relative](README.md) <!-- [hidden](https://hidden.test) -->' }
  ]), (item) => item.path || item.url), ['https://example.test/', 'README.md']);
  const rawHtml = extractTurnCandidates([{ type: 'text', text:
    '<pre>\n[hidden](https://hidden.test)\n</pre> ' +
    '<span title="[attribute](https://attribute.test)">text</span> ' +
    '[real](https://real.test)' }]);
  assert.deepEqual(Array.from(rawHtml, (item) => item.url), ['https://real.test/']);
  dom.window.close();
});

test('web URLs follow Markdown escaping and entities before validating true host', () => {
  const dom = simpleDom();
  const { extractTurnCandidates } = loadClient(dom);
  const items = extractTurnCandidates([{ type: 'text', text: String.raw`
[wiki](https://example.org/wiki/Foo_\(bar\))
[angle](<https://example.org/wiki/Foo_\(bar\)>)
[query](https://example.test/?a=1&amp;b=2)
[host](https://trusted.example&#46;evil.example/path)
[unknown](https://example.test/?x=&unknownEntity;)
` }]);
  assert.deepEqual(Array.from(items, ({ name, url, host }) => [name, url, host]), [
    ['wiki', 'https://example.org/wiki/Foo_(bar)', 'example.org'],
    ['query', 'https://example.test/?a=1&b=2', 'example.test'],
    ['host', 'https://trusted.example.evil.example/path', 'trusted.example.evil.example']
  ]);
  dom.window.close();
});

test('accepts only successful same-turn structured edit/write diffs before the closing reply', () => {
  const dom = simpleDom();
  const { collectTurnSources, extractTurnCandidates } = loadClient(dom);
  const write = editedTool('new file.md', { call: { name: 'write',
    argsRaw: JSON.stringify({ file_path: 'new file.md' }) },
    meta: { diffs: [{ path: 'new file.md', oldText: '', newText: 'hello' }] } });
  const created = createdTool('fresh.md');
  const snapshot = snapshotFor({ assistant: '已处理。', tools: [
    editedTool('README.md'), write, created,
    editedTool('broken.md', { isError: true }),
    editedTool('untrusted.md', { meta: { diffs: [{ path: 'other.md' }] } }),
    editedTool('late.md', { seq: 4 }),
    { ...editedTool('hidden.md'), visibility: 'hidden' },
    editedTool('prose.md', { call: { name: 'bash', argsRaw: '{"file_path":"prose.md"}' } }),
    editedTool('invalid.md', { call: { name: 'edit', argsRaw: '{invalid' } })
  ] });
  const files = extractTurnCandidates(collectTurnSources(snapshot, 'answer'));
  assert.deepEqual(Array.from(files, ({ path }) => path), ['README.md', 'new file.md', 'fresh.md']);
  assert.ok(files.every((item) => item.edited));
  assert.equal(files[2].created, true);
  assert.equal(collectTurnSources(snapshot, 'unknown').length, 0);
  dom.window.close();
});

test('reserves room for edited files after a turn with 200 web links', () => {
  const dom = simpleDom();
  const { extractTurnCandidates } = loadClient(dom);
  const text = Array.from({ length: 200 }, (_, index) =>
    `[link ${index}](https://example.test/${index})`).join(' ');
  const items = extractTurnCandidates([{ type: 'text', text },
    { type: 'edited-file', path: 'README.md' }]);
  assert.equal(items.length, 200);
  assert.equal(items.filter((item) => item.type === 'web').length, 199);
  assert.equal(items.at(-1).path, 'README.md');
  assert.equal(items.at(-1).edited, true);
  dom.window.close();
});

test('copies escaped Markdown without confusing encoded filename characters', () => {
  const dom = simpleDom();
  const { copyMarkdown } = loadClient(dom);
  assert.equal(copyMarkdown('/local/a #b?.jpg', '图[一]'), '[图\\[一\\]](</local/a%20%23b%3F.jpg>)');
  dom.window.close();
});

test('local and web Markdown entities round-trip without changing the target', () => {
  const dom = simpleDom();
  const { extractFileCandidates, extractTurnCandidates, copyMarkdown, copyWebMarkdown } = loadClient(dom);
  assert.deepEqual(Array.from(extractFileCandidates([
    '[rendered](<a&amp;b.pdf>) [literal](<a%26amp;b.pdf>) ' +
      '[numeric](<a&#38;b.pdf>) [unknown](<a&notSupportedEntity;b.pdf>)'
  ]), ({ path }) => path), ['a&b.pdf', 'a&amp;b.pdf']);
  const local = copyMarkdown('a&amp;b.pdf', 'literally &amp;');
  assert.equal(local, '[literally &#38;amp;](<a%26amp;b.pdf>)');
  assert.equal(extractFileCandidates([local])[0].path, 'a&amp;b.pdf');
  assert.equal(extractFileCandidates([copyMarkdown('a&b.pdf', 'rendered')])[0].path, 'a&b.pdf');
  assert.equal(extractTurnCandidates([{ type: 'text', text:
    String.raw`[escaped](<https://example.test/?q=\&amp;>)` }])[0].url,
  'https://example.test/?q=&amp;');
  const original = 'https://example.test/?x=&amp;&next=1';
  const web = copyWebMarkdown(original, 'query');
  assert.equal(web, '[query](<https://example.test/?x=&#38;amp;&next=1>)');
  assert.equal(extractTurnCandidates([{ type: 'text', text: web }])[0].url, original);
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

test('open mixed resource popup follows global language without revalidating files', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const locale = localeFace('zh');
  const dispose = installLocale(client, locale);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const statCalls = [];
  const copied = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true,
    value: { writeText: async (text) => { copied.push(text); } } });
  const remote = { workspaceFiles: { stat: async (sessionId, path) => {
    statCalls.push([sessionId, path]);
    return { ok: true, value: { absolutePath: `/work/${path}` } };
  } }, session: { openWorkspacePath: () => { throw new Error('not used'); } } };
  try {
    await act(async () => root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'session-A', remote, locale,
      useChat: (selector) => selector(snapshotFor({
        assistant: '[file](docs/report.pdf) [site](https://example.test/download)',
        tools: [editedTool('README.md')]
      }))
    })));
    const trigger = dom.window.document.querySelector('[data-turn-files-button]');
    assert.match(trigger.getAttribute('aria-label'), /本轮资源，3 个候选/u);
    await act(async () => trigger.click());
    assert.equal(statCalls.length, 2);
    assert.match(dom.window.document.querySelector('.dtfa-row').textContent, /README\.md.*已编辑/u);
    await act(async () => locale.setLocale('en'));
    const panel = dom.window.document.querySelector('[data-turn-files-panel]');
    assert.equal(panel.getAttribute('aria-label'), 'Turn resources');
    assert.equal(panel.querySelector('.dtfa-list').getAttribute('aria-label'), 'Resource list');
    assert.match(dom.window.document.querySelector('.dtfa-row').textContent, /README\.md.*Edited/u);
    assert.match(trigger.getAttribute('aria-label'), /Turn resources, 3 candidates/u);
    const web = Array.from(panel.querySelectorAll('.dtfa-row')).find((row) => row.querySelector('a.dtfa-open'));
    assert.match(web.querySelector('a.dtfa-open').getAttribute('aria-label'), /destination example\.test/u);
    await act(async () => web.querySelector('[title="More actions"]').click());
    assert.deepEqual(Array.from(web.querySelectorAll('.dtfa-more-action'), (button) => button.textContent),
      ['Copy URL', 'Copy Markdown link']);
    await act(async () => web.querySelector('.dtfa-more-action').click());
    assert.equal(panel.querySelector('.dtfa-status').textContent, 'Copied');
    assert.deepEqual(copied, ['https://example.test/download']);
    await act(async () => locale.setLocale('zh'));
    assert.equal(panel.querySelector('.dtfa-status').textContent, '已复制');
    assert.equal(statCalls.length, 2);
  } finally {
    await act(async () => root.unmount());
    dispose();
    dom.window.close();
  }
});

test('single resource count is grammatical in English and remains Chinese after switching back', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const locale = localeFace('en');
  const dispose = installLocale(client, locale);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  try {
    await act(async () => root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'S', remote: {}, locale,
      useChat: (selector) => selector(snapshotFor({ assistant: '[one](https://example.test)' }))
    })));
    const trigger = dom.window.document.querySelector('[data-turn-files-button]');
    assert.equal(trigger.getAttribute('aria-label'), 'Turn resources, 1 candidate');
    await act(async () => locale.setLocale('zh'));
    assert.equal(trigger.getAttribute('aria-label'), '本轮资源，1 个候选');
  } finally {
    await act(async () => root.unmount());
    dispose();
    dom.window.close();
  }
});

test('web-only turn uses native safe anchors and copies links without Host file calls', async () => {
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
  const calls = [];
  const copied = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true,
    value: { writeText: async (text) => { copied.push(text); } } });
  const remote = { workspaceFiles: { stat: () => { calls.push('stat'); } },
    session: { openWorkspacePath: () => { calls.push('open'); } } };
  const unavailable = { status: 'unavailable', value: undefined };
  const form = { subscribe: () => () => {}, getSnapshot: () => unavailable };
  try {
    await act(async () => root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'S', remote, form,
      useChat: (selector) => selector(snapshotFor({ assistant:
        '[trusted.example](https://evil.example/landing?x=1#info) ' +
        '[download](https://github.com/nico/pkg.tgz)' }))
    })));
    const trigger = dom.window.document.querySelector('[data-turn-files-button]');
    assert.ok(trigger);
    assert.match(trigger.getAttribute('aria-label'), /2 个候选/u);
    await act(async () => trigger.click());
    const rows = Array.from(dom.window.document.querySelectorAll('.dtfa-row'));
    assert.equal(rows.length, 2);
    assert.equal(calls.length, 0);
    const anchor = rows[0].querySelector('a.dtfa-open');
    assert.equal(anchor.href, 'https://evil.example/landing?x=1#info');
    assert.equal(anchor.target, '_blank');
    assert.equal(anchor.rel, 'noopener noreferrer');
    assert.match(anchor.getAttribute('aria-label'), /evil\.example/u);
    assert.equal(rows[0].querySelector('.dtfa-link-host').textContent, 'evil.example');
    assert.equal(rows[0].querySelector('[title="在文件管理器中显示"]'), null);
    await act(async () => rows[0].querySelector('[title="更多操作"]').click());
    const actions = rows[0].querySelectorAll('.dtfa-more-action');
    assert.deepEqual(Array.from(actions, (button) => button.textContent), ['复制网址', '复制 Markdown 链接']);
    await act(async () => actions[0].click());
    await act(async () => actions[1].click());
    assert.deepEqual(copied, [anchor.href, '[trusted.example](<https://evil.example/landing?x=1#info>)']);
    assert.deepEqual(calls, []);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('unavailable local file and settings do not disable adjacent web link', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const locale = localeFace('en');
  const dispose = installLocale(client, locale);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const calls = [];
  const remote = { workspaceFiles: { stat: async (sessionId, path) => {
    calls.push([sessionId, path]);
    return { ok: false, error: { message: 'not found' } };
  } }, session: { openWorkspacePath: () => { throw new Error('must not open'); } } };
  const unavailable = { status: 'unavailable', value: undefined };
  try {
    await act(async () => root.render(React.createElement(client.TurnFilesAction, {
      messageId: 'answer', sessionId: 'S', remote, locale,
      form: { subscribe: () => () => {}, getSnapshot: () => unavailable },
      useChat: (selector) => selector(snapshotFor({ assistant:
        '[local](missing.pdf) [release](https://github.com/nico/release)' }))
    })));
    await act(async () => dom.window.document.querySelector('[data-turn-files-button]').click());
    assert.deepEqual(calls, [['S', 'missing.pdf']]);
    const rows = dom.window.document.querySelectorAll('.dtfa-row');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelector('button.dtfa-open').disabled, true);
    assert.equal(rows[1].querySelector('a.dtfa-open').href, 'https://github.com/nico/release');
    assert.equal(rows[1].querySelector('a.dtfa-open').hasAttribute('disabled'), false);
    assert.match(rows[0].textContent, /File unavailable/u);
    assert.equal(rows[0].querySelector('[role="status"]').getAttribute('aria-description'), 'not found');
    assert.match(dom.window.document.querySelector('.dtfa-status').textContent,
      /Could not load open-mode settings/u);
    await act(async () => locale.setLocale('zh'));
    assert.match(rows[0].textContent, /文件不可用/u);
    assert.match(dom.window.document.querySelector('.dtfa-status').textContent,
      /无法读取打开方式设置/u);
    assert.equal(calls.length, 1);
  } finally {
    await act(async () => root.unmount());
    dispose();
    dom.window.close();
  }
});

test('edit card alone enables a file only after same-session Host validation', async () => {
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
  const native = [];
  const remote = { workspaceFiles: { stat: async (sessionId, path) => {
    statCalls.push([sessionId, path]);
    return { ok: true, value: { absolutePath: `/workspace/${path}` } };
  } }, session: { openWorkspacePath: async (request) => {
    native.push(request);
    return { ok: true, value: {} };
  } } };
  let snapshot = snapshotFor({ assistant: '已修改。', tools: [editedTool('README.md')] });
  const render = async () => act(async () => root.render(React.createElement(client.TurnFilesAction, {
    messageId: 'answer', sessionId: 'actual-session', remote,
    useChat: (selector) => selector(snapshot)
  })));
  try {
    await render();
    const trigger = dom.window.document.querySelector('[data-turn-files-button]');
    assert.ok(trigger);
    await act(async () => trigger.click());
    assert.deepEqual(statCalls, [['actual-session', 'README.md']]);
    const row = dom.window.document.querySelector('.dtfa-row');
    assert.match(row.textContent, /README\.md.*已编辑/u);
    await act(async () => row.querySelector('.dtfa-open').click());
    assert.equal(native[0].path, '/workspace/README.md');
    snapshot = snapshotFor({ assistant: '已创建。', tools: [createdTool('fresh.md')] });
    await render();
    assert.deepEqual(statCalls[1], ['actual-session', 'fresh.md']);
    const created = dom.window.document.querySelector('.dtfa-row');
    assert.match(created.textContent, /fresh\.md.*已新建/u);
    await act(async () => created.querySelector('.dtfa-open').click());
    assert.equal(native[1].path, '/workspace/fresh.md');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
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

test('plugin-manager summary and settings react to global zh/en switches without changing preferences', async () => {
  const dom = simpleDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ReactDOM = await import('react-dom');
  const client = loadClient(dom, ReactDOM);
  const locale = localeFace('zh');
  const dispose = installLocale(client, locale);
  const root = createRoot(dom.window.document.querySelector('#mount'));
  const mutations = [];
  const form = { state: { status: 'ready', writable: true, mode: 'host', revision: 7,
    value: { openMode: 'system', copyActions: ['path', 'name', 'markdown'] } },
  mutate: async (patch, revision) => { mutations.push({ patch, revision }); return true; } };
  const render = (view) => act(async () => root.render(React.createElement(client.SettingsPage,
    { view, form, locale })));
  try {
    await render('summary');
    assert.match(dom.window.document.body.textContent, /系统应用打开 · 3 项复制操作/u);
    await act(async () => locale.setLocale('en'));
    assert.match(dom.window.document.body.textContent, /Open in system app · 3 copy actions/u);
    await render('page');
    assert.match(dom.window.document.body.textContent, /When clicking a file name/u);
    assert.match(dom.window.document.body.textContent, /Copy buttons in More actions/u);
    assert.match(dom.window.document.body.textContent, /Copy file name/u);
    assert.ok(dom.window.document.querySelector('[aria-label="Move Copy path down"]'));
    await act(async () => dom.window.document.querySelector('.dtfa-settings-save').click());
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /Settings saved/u);
    assert.equal(mutations[0].revision, 7);
    await act(async () => locale.setLocale('zh'));
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /设置已保存/u);
    assert.equal(dom.window.document.querySelectorAll('.dtfa-settings input:checked').length, 4);
    form.state = { ...form.state, revision: 8,
      value: { ...form.state.value, copyActions: ['path'] } };
    await act(async () => locale.setLocale('en'));
    await render('summary');
    assert.match(dom.window.document.body.textContent, /1 copy action$/u);
    await act(async () => locale.setLocale('zh'));
    assert.match(dom.window.document.body.textContent, /1 项复制操作$/u);
    assert.equal(mutations.length, 1);
  } finally {
    await act(async () => root.unmount());
    dispose();
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
    const disposers = [];
    client.apply({ remote, locale: localeFace(), configForms: { get: () => ({}) }, slots: { inject: () => {} },
      effect: (effect) => { disposers.push(effect()); } });
    const styles = dom.window.document.querySelector('style[data-plugin-css="dsh-chat-file-actions"]').textContent;
    assert.match(styles, /\.dtfa-list\s*\{[^}]*overflow-y:auto/u);
    assert.match(styles, /--dsw-alias-bg-overlay/u);
    assert.match(styles, /--dsw-alias-border-l1/u);
    assert.match(styles, /prefers-color-scheme:dark/u);
    assert.match(styles, /\.dtfa-trigger svg\s*\{\s*width:17px/u);
    for (const dispose of disposers.reverse()) dispose();
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
