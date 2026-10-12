window.__ModuleLoader__.load({
  id: "dsh-chat-file-actions",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const ReactDOM = require("react-dom");
    const { IconPaperclipOutlineRegular, IconFolderOpenOutlineRegular,
      IconEllipsisOutlineRegular, FileTypeIcon } = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;
    const MAX_FILES = 200;
    const MAX_STAT_CONCURRENCY = 6;
    const MAX_TEXT = 200000;
    const SETTINGS_NS = "chat-file-actions";
    const LOCALE_NS = "dsh-chat-file-actions";
    const DEFAULT_COPY_ACTIONS = ["path", "name", "markdown"];
    const TEXT = {
      zh: {
        copyPath: "复制路径", copyName: "复制文件名", copyLink: "复制链接",
        summaryOne: "{mode}打开 · {count} 项复制操作", summaryMany: "{mode}打开 · {count} 项复制操作",
        systemApp: "系统应用", sidebar: "DSH 侧栏",
        settingsSaved: "设置已保存", settingsStale: "设置未保存，请重新读取后再试",
        settingsSaveFailed: "设置保存失败", settingsLoading: "正在读取设置…",
        settingsUnsupported: "当前连接或 Profile 不支持保存设置", settingsOpenLegend: "点击文件名时",
        systemChoice: "用系统默认应用打开", sidebarChoice: "在 DSH 侧栏打开",
        settingsCopyLegend: "更多操作中的复制按钮", moveUp: "上移{label}", moveDown: "下移{label}",
        settingsHint: "侧栏不可用时不会自动启动系统应用；仍可在文件的「更多操作」中手动打开。",
        saving: "保存中…", saveSettings: "保存设置", verifyFailed: "验证文件失败",
        absoluteUnknown: "无法确定文件绝对路径", fileUnavailable: "文件不可用",
        clipboardUnavailable: "此窗口不能写入剪贴板", copied: "已复制", actionFailed: "操作失败",
        sidebarUnavailable: "当前会话的 DSH 侧栏不可用，请从「更多操作」选择系统打开",
        sidebarRequested: "已请求在 DSH 侧栏打开文件", revealFailed: "显示文件失败",
        openFailed: "打开文件失败", revealRequested: "已请求系统定位文件",
        openRequested: "已请求系统打开文件", fileManager: "在文件管理器中显示",
        revealAria: "在文件管理器中显示：{name}",
        browserTitle: "在浏览器打开：{url}", browserAria: "在浏览器打开 {name}，目标 {host}",
        more: "更多操作", moreWebAria: "更多操作：{name}，{host}", moreFileAria: "更多操作：{name}",
        duplicateName: "{name}（{parent}）",
        copyUrl: "复制网址", copyMarkdown: "复制 Markdown 链接", openInSidebar: "在侧栏打开",
        openVerb: "打开", openFileAria: "{mode} {name}", openFileTitle: "{mode}：{path}",
        createdHint: "本轮已新建", editedHint: "本轮已编辑", created: "已新建", edited: "已编辑",
        verifying: "正在验证文件", systemOpen: "用系统应用打开",
        settingsOpening: "正在读取打开方式设置",
        settingsOpeningFailed: "无法读取打开方式设置，仍可从「更多操作」手动用系统打开",
        limit: "最多展示前 {count} 个资源", resources: "本轮资源", resourceList: "资源列表",
        triggerAriaOne: "本轮资源，{count} 个候选", triggerAriaMany: "本轮资源，{count} 个候选"
      },
      en: {
        copyPath: "Copy path", copyName: "Copy file name", copyLink: "Copy link",
        summaryOne: "Open in {mode} · {count} copy action",
        summaryMany: "Open in {mode} · {count} copy actions", systemApp: "system app", sidebar: "DSH sidebar",
        settingsSaved: "Settings saved", settingsStale: "Settings were not saved. Reload and try again.",
        settingsSaveFailed: "Failed to save settings", settingsLoading: "Loading settings…",
        settingsUnsupported: "This connection or Profile cannot save settings",
        settingsOpenLegend: "When clicking a file name", systemChoice: "Open with default system app",
        sidebarChoice: "Open in DSH sidebar", settingsCopyLegend: "Copy buttons in More actions",
        moveUp: "Move {label} up", moveDown: "Move {label} down",
        settingsHint: "If the sidebar is unavailable, the system app will not open automatically. You can still open the file from More actions.",
        saving: "Saving…", saveSettings: "Save settings", verifyFailed: "Failed to verify file",
        absoluteUnknown: "Could not determine the absolute file path", fileUnavailable: "File unavailable",
        clipboardUnavailable: "Clipboard access is unavailable in this window", copied: "Copied",
        actionFailed: "Action failed", sidebarUnavailable: "The sidebar is unavailable for this session. Choose Open with system app from More actions.",
        sidebarRequested: "Requested to open file in DSH sidebar", revealFailed: "Failed to reveal file",
        openFailed: "Failed to open file", revealRequested: "Requested to reveal file in file manager",
        openRequested: "Requested to open file with system app", fileManager: "Reveal in file manager",
        revealAria: "Reveal {name} in file manager",
        browserTitle: "Open in browser: {url}", browserAria: "Open {name} in browser, destination {host}",
        more: "More actions", moreWebAria: "More actions: {name}, {host}", moreFileAria: "More actions: {name}",
        duplicateName: "{name} ({parent})",
        copyUrl: "Copy URL", copyMarkdown: "Copy Markdown link", openInSidebar: "Open in sidebar",
        openVerb: "Open", openFileAria: "{mode} {name}", openFileTitle: "{mode}: {path}",
        createdHint: "Created this turn", editedHint: "Edited this turn", created: "Created", edited: "Edited",
        verifying: "Verifying file", systemOpen: "Open with system app",
        settingsOpening: "Loading open-mode settings",
        settingsOpeningFailed: "Could not load open-mode settings. You can still choose Open with system app from More actions.",
        limit: "Showing at most {count} resources", resources: "Turn resources", resourceList: "Resource list",
        triggerAriaOne: "Turn resources, {count} candidate",
        triggerAriaMany: "Turn resources, {count} candidates"
      }
    };
    const DEFAULT_LOCALE_SNAPSHOT = { active: "zh", revision: 0 };
    const DEFAULT_FORM_SNAPSHOT = { status: "ready", value: undefined };
    const noFormSubscribe = () => () => {};
    const noFormSnapshot = () => DEFAULT_FORM_SNAPSHOT;
    const noLocaleSnapshot = () => DEFAULT_LOCALE_SNAPSHOT;

    function useText(locale) {
      const [subscribe, getSnapshot] = React.useMemo(() => locale?.subscribe && locale?.getSnapshot ?
        [locale.subscribe.bind(locale), locale.getSnapshot.bind(locale)] :
        [noFormSubscribe, noLocaleSnapshot], [locale]);
      const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const language = /^zh(?:-|$)/iu.test(snapshot?.active || "") ? "zh" : "en";
      const translate = locale?.bind?.(LOCALE_NS);
      const t = (key, values = {}) => translate ? translate(key, values) :
        (TEXT[language][key] || TEXT.zh[key] || key)
          .replace(/\{(\w+)\}/gu, (_, name) => String(values[name] ?? ""));
      return { t };
    }

    function copyLabel(t, id) {
      return t({ path: "copyPath", name: "copyName", markdown: "copyLink" }[id]);
    }

    function readSettings(value) {
      const copyActions = Array.isArray(value?.copyActions) ?
        [...new Set(value.copyActions.filter((id) => DEFAULT_COPY_ACTIONS.includes(id)))] :
        [...DEFAULT_COPY_ACTIONS];
      return { openMode: value?.openMode === "sidebar" ? "sidebar" : "system", copyActions };
    }

    // Match DSH's session-scoped dsh-resource://file address grammar. The Host
    // still resolves the stat-verified absolute path for this exact Session.
    function sessionFileAddress(sessionId, path) {
      const encode = (part) => encodeURIComponent(part).replace(/%3A/giu, ":");
      const normalized = path.replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, "");
      return `dsh-resource://file/session/${encode(sessionId)}/${normalized.split("/").map(encode).join("/")}`;
    }

    const css = `
      .dtfa-trigger { display:inline-flex; align-items:center; justify-content:center; gap:2px;
        height:28px; min-width:28px; padding:0 5px; border:0; border-radius:var(--dsw-radius-sm,6px);
        background:transparent; color:var(--dsw-alias-label-tertiary,#767676);
        font:inherit; font-size:11px; line-height:1; cursor:pointer; }
      .dtfa-trigger svg { width:17px; height:17px; flex:none; }
      .dtfa-trigger:hover, .dtfa-trigger[aria-expanded=true] { color:var(--dsw-alias-label-secondary,#555);
        background:var(--dsw-alias-interactive-bg-hover,#8882); }
      .dtfa-panel { --dtfa-surface:#fff; --dtfa-divider:#e5e5e5; --dtfa-hover:#f2f3f5;
        position:fixed; z-index:2147483000; box-sizing:border-box; display:flex; flex-direction:column;
        width:min(380px, calc(100vw - 16px)); overflow:hidden; padding:4px;
        border:1px solid var(--dsw-alias-border-l1,var(--dtfa-divider));
        border-radius:var(--dsw-radius-lg,10px);
        background:var(--dsw-alias-bg-overlay,var(--dtfa-surface));
        color:var(--dsw-alias-label-primary,#222); box-shadow:0 12px 32px #0003;
        font:12px/1.4 system-ui,sans-serif; }
      @media (prefers-color-scheme:dark) { .dtfa-panel { --dtfa-surface:#252629;
        --dtfa-divider:#4c4d50; --dtfa-hover:#ffffff18; color:var(--dsw-alias-label-primary,#f5f5f5); } }
      .dtfa-heading { flex:none; display:flex; align-items:center; justify-content:space-between;
        min-height:30px; padding:2px 9px 5px; font-weight:600; }
      .dtfa-heading-count { font-size:11px; font-weight:400; color:var(--dsw-alias-label-secondary,#777); }
      .dtfa-list { min-height:0; max-height:min(44vh, 350px); overflow-y:auto;
        overscroll-behavior:contain; scrollbar-gutter:stable; }
      .dtfa-row { border-top:1px solid var(--dsw-alias-border-l1,var(--dtfa-divider)); padding:3px 5px; }
      .dtfa-row-main { display:flex; align-items:center; gap:2px; min-width:0; }
      .dtfa-open { display:flex; align-items:center; gap:7px; flex:1; min-width:0; min-height:32px;
        padding:4px 5px; border:0; border-radius:6px; background:transparent;
        color:var(--dsw-alias-label-primary,#222); font:inherit; font-weight:500;
        text-align:left; cursor:pointer; }
      .dtfa-open svg { width:16px; height:16px; flex:none; }
      .dtfa-open[href] { text-decoration:none; }
      .dtfa-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dtfa-link-host { flex:none; max-width:105px; overflow:hidden; text-overflow:ellipsis;
        white-space:nowrap; color:var(--dsw-alias-label-secondary,#777); font-size:10px; font-weight:400; }
      .dtfa-parent { margin:-1px 4px 3px 28px; overflow:hidden; text-overflow:ellipsis;
        white-space:nowrap; color:var(--dsw-alias-label-secondary,#777); font-size:10px; }
      .dtfa-icon { display:inline-flex; align-items:center; justify-content:center; flex:none;
        width:28px; height:28px; padding:5px; border:0; border-radius:6px;
        background:transparent; color:var(--dsw-alias-label-secondary,#777); cursor:pointer; }
      .dtfa-icon svg { width:16px; height:16px; }
      .dtfa-open:hover:not(:disabled), .dtfa-icon:hover:not(:disabled),
      .dtfa-more-action:hover { background:var(--dsw-alias-interactive-bg-hover,var(--dtfa-hover)); }
      .dtfa-open:disabled, .dtfa-icon:disabled { cursor:default; opacity:.5; }
      .dtfa-more-actions { display:flex; gap:3px; flex-wrap:wrap; margin:1px 0 4px 28px; }
      .dtfa-more-action { border:0; border-radius:5px; padding:4px 6px;
        background:var(--dsw-alias-bg-layer-2,var(--dtfa-hover));
        color:var(--dsw-alias-label-secondary,#555); font:inherit; cursor:pointer; }
      .dtfa-status { flex:none; margin:0; padding:6px 9px 4px;
        border-top:1px solid var(--dsw-alias-border-l1,var(--dtfa-divider));
        color:var(--dsw-alias-label-secondary,#777); font-size:11px; }
      .dtfa-trigger:focus-visible, .dtfa-panel button:focus-visible, .dtfa-panel a:focus-visible,
      .dtfa-panel:focus-visible,
      .dtfa-settings button:focus-visible, .dtfa-settings input:focus-visible {
        outline:2px solid var(--dsw-alias-brand-primary,#4774cc); outline-offset:2px; }
      .dtfa-settings { display:grid; gap:12px; max-width:520px; color:var(--dsw-alias-label-primary,#222);
        font:13px/1.5 system-ui,sans-serif; }
      .dtfa-settings fieldset { margin:0; padding:10px 12px; border:1px solid var(--dsw-alias-border-l1,#8885);
        border-radius:var(--dsw-radius-sm,6px); }
      .dtfa-settings legend { font-weight:600; padding:0 4px; }
      .dtfa-settings-choice { display:flex; align-items:center; gap:7px; margin:5px 0; }
      .dtfa-settings-item { display:flex; align-items:center; justify-content:space-between;
        gap:8px; min-height:32px; }
      .dtfa-settings-item button, .dtfa-settings-save { border:1px solid var(--dsw-alias-border-l1,#8885);
        border-radius:5px; padding:4px 8px; background:var(--dsw-alias-bg-layer-2,#8882);
        color:inherit; font:inherit; cursor:pointer; }
      .dtfa-settings-item button:disabled, .dtfa-settings-save:disabled { opacity:.5; cursor:default; }
      .dtfa-settings-hint, .dtfa-settings-status { margin:0; color:var(--dsw-alias-label-secondary,#777); }
      @media (prefers-color-scheme:dark) { .dtfa-settings {
        color:var(--dsw-alias-label-primary,#f5f5f5); } }
    `;

    function textBlocks(blocks) {
      if (!Array.isArray(blocks)) return [];
      return blocks.filter((block) => block && (block.kind === "text" || block.type === "text") &&
        typeof block.text === "string").map((block) => block.text);
    }

    // The action slot belongs to the final Assistant message of one Turn. Use
    // its durable message id to locate that Turn, never the selected workspace or
    // whichever other conversation is currently in focus. DSH 0.2.0-rc.2 stores
    // applied file-edit cards in settled tool-call nodes with structured diffs.
    function collectTurnSources(snapshot, messageId) {
      if (!snapshot?.nodes || !snapshot.locations?.getTurn) return [];
      let closing;
      for (const node of snapshot.nodes.values()) {
        if (node?.kind === "assistant-step" && node.data?.finalNode?.messageId === messageId) {
          closing = node;
          break;
        }
      }
      if (!closing) return [];
      const turn = closing.data.turn;
      const through = closing.data.finalNode.seq;
      const result = [];
      for (const key of snapshot.locations.getTurn(turn)) {
        const node = snapshot.nodes.get(key);
        if (!node || node.visibility === "hidden" || (node.anchorSeq ?? 0) > through) continue;
        if (node.kind === "user" || node.kind === "steering") {
          result.push(...textBlocks(node.data?.content).map((text) => ({ type: "text", text })));
        } else if (node.kind === "assistant-step" && node.data?.finalNode &&
          node.data.finalNode.seq <= through) {
          result.push(...textBlocks(node.data.blocks).map((text) => ({ type: "text", text })));
        } else if (node.kind === "tool-call") {
          const root = node.data?.root;
          if (root?.kind !== "tool-result" || root.isError || !Number.isFinite(root.seq) ||
            root.seq > through || !["edit", "write"].includes(root.call?.name) ||
            typeof root.call.argsRaw !== "string" || !Array.isArray(root.meta?.diffs)) continue;
          let args;
          try { args = JSON.parse(root.call.argsRaw); } catch { continue; }
          const path = args?.file_path;
          if (typeof path !== "string" || !path || path.length > 4096 ||
            /[\u0000-\u001f\u007f]/u.test(path) || path.endsWith("/") || path.endsWith("\\") ||
            (/^[a-z][a-z\d+.-]*:/iu.test(path) && !/^[a-z]:[\\/]/iu.test(path))) continue;
          // A successful write creating a new file has no before-text, so DSH
          // reports operation=create with an empty diffs array.
          const created = root.call.name === "write" && root.meta.operation === "create" &&
            root.meta.diffs.length === 0;
          if (root.meta.diffs.some((diff) => diff?.path === path) || created)
            result.push({ type: "edited-file", path, created });
        }
      }
      return result;
    }

    function collectTurnTexts(snapshot, messageId) {
      return collectTurnSources(snapshot, messageId).filter((item) => item.type === "text")
        .map((item) => item.text);
    }

    function sameSources(left, right) {
      return left.length === right.length && left.every((item, index) =>
        item.type === right[index].type && item.text === right[index].text &&
        item.path === right[index].path && item.created === right[index].created);
    }

    // Mask code spans/fences, indented code and HTML comments: examples and
    // comments are not clickable local-file links in the settled Markdown UI.
    function withoutCode(text) {
      let fence = null;
      let inline = 0;
      let comment = false;
      let offset = 0;
      let budget = Math.min(text.length * 4, 800000);
      const hasCloser = (run, start) => {
        for (let at = start; at < text.length; at++) {
          if (--budget < 0) return false;
          if (text[at] !== "`") continue;
          let end = at + 1;
          while (text[end] === "`") end++;
          if (end - at === run) return true;
          at = end - 1;
        }
        return false;
      };
      return text.split(/(\n)/u).map((line) => {
        const start = offset;
        offset += line.length;
        if (line === "\n") return line;
        const marker = /^[ \t]{0,3}(`{3,}|~{3,})/u.exec(line);
        if (fence) {
          if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length &&
            /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*\r?$/u.test(line)) fence = null;
          return " ".repeat(line.length);
        }
        if (marker && inline === 0 && !comment) {
          fence = marker[1];
          return " ".repeat(line.length);
        }
        if (!comment && inline === 0 && /^(?: {4,}|\t)/u.test(line)) return " ".repeat(line.length);
        const chars = line.split("");
        for (let i = 0; i < chars.length; i++) {
          if (comment) {
            if (chars.slice(i, i + 3).join("") === "-->") {
              chars.splice(i, 3, " ", " ", " ");
              comment = false;
              i += 2;
            } else chars[i] = " ";
          } else if (chars[i] === "`") {
            let end = i + 1;
            while (chars[end] === "`") end++;
            const run = end - i;
            let slashes = 0;
            for (let j = i - 1; j >= 0 && chars[j] === "\\"; j--) slashes++;
            if (inline === 0 && (slashes % 2 || !hasCloser(run, start + end))) {
              i = end - 1;
              continue;
            }
            if (inline === 0) inline = run;
            else if (inline === run) inline = 0;
            for (let j = i; j < end; j++) chars[j] = " ";
            i = end - 1;
          } else if (inline > 0) chars[i] = " ";
          else if (chars.slice(i, i + 4).join("") === "<!--") {
            chars.splice(i, 4, " ", " ", " ", " ");
            comment = true;
            i += 3;
          }
        }
        return chars.join("");
      }).join("");
    }

    // A bounded scan keeps balanced URL parentheses and nested link labels intact.
    // It is deliberately limited to explicit inline Markdown links, not all Markdown.
    function markdownLinks(text) {
      const links = [];
      let budget = Math.min(text.length * 8, 800000);
      const escaped = (index) => {
        let count = 0;
        for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) count++;
        return count % 2 === 1;
      };
      const htmlTagAt = (index) => {
        const opening = /^<\/?([a-z][a-z\d-]*)(?=[\s/>])/iu.exec(text.slice(index, index + 40));
        if (!opening) return null;
        let quote = null;
        for (let at = index + opening[0].length; at < Math.min(text.length, index + 4096); at++) {
          if (quote) { if (text[at] === quote) quote = null; }
          else if (text[at] === '"' || text[at] === "'") quote = text[at];
          else if (text[at] === ">") return { end: at, name: opening[1].toLowerCase(),
            closing: text[index + 1] === "/", selfClosing: text[at - 1] === "/" };
        }
        return null;
      };
      let rawTag = null;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "<") {
          const tag = htmlTagAt(i);
          if (tag) {
            if (rawTag === tag.name && tag.closing) rawTag = null;
            else if (!rawTag && !tag.closing && !tag.selfClosing &&
              ["pre", "code", "script", "style"].includes(tag.name)) rawTag = tag.name;
            i = tag.end;
            continue;
          }
        }
        if (rawTag || text[i] !== "[" || escaped(i)) continue;
        const limit = Math.min(text.length, i + 4096);
        let depth = 1;
        let end = i + 1;
        for (; end < limit; end++) {
          if (--budget < 0) return links;
          if (text[end] === "\n") break;
          if (escaped(end)) continue;
          if (text[end] === "[") depth++;
          if (text[end] === "]" && --depth === 0) break;
        }
        if (depth || end >= limit || text[end + 1] !== "(") continue;
        let pos = end + 2;
        while (text[pos] === " " || text[pos] === "\t") pos++;
        let destination;
        if (text[pos] === "<") {
          const start = ++pos;
          for (; pos < limit && text[pos] !== ">" && text[pos] !== "\n"; pos++) {
            if (--budget < 0) return links;
            if (text[pos] === "\\" && pos + 1 < limit) pos++;
          }
          if (pos >= limit || text[pos] !== ">") { continue; }
          destination = text.slice(start, pos++);
        } else {
          const start = pos;
          let nested = 0;
          for (; pos < limit; pos++) {
            if (--budget < 0) return links;
            if (text[pos] === "\\" && pos + 1 < limit) { pos++; continue; }
            if (text[pos] === "(") nested++;
            else if (text[pos] === ")") {
              if (!nested) break;
              nested--;
            } else if (/\s/u.test(text[pos])) break;
          }
          if (nested || start === pos || pos >= limit) { continue; }
          destination = text.slice(start, pos);
        }
        while (text[pos] === " " || text[pos] === "\t") pos++;
        if (text[pos] === "\"" || text[pos] === "'") {
          const quote = text[pos++];
          while (pos < limit && text[pos] !== quote && text[pos] !== "\n") {
            if (--budget < 0) return links;
            if (text[pos] === "\\" && pos + 1 < limit) pos++;
            pos++;
          }
          if (text[pos++] !== quote) { continue; }
          while (text[pos] === " " || text[pos] === "\t") pos++;
        }
        if (text[pos] !== ")") { continue; }
        links.push({ index: i, label: text.slice(i + 1, end), destination });
        i = pos;
      }
      return links;
    }

    function localDestination(value) {
      if (!value) return null;
      // A lone backslash before Markdown punctuation could also be a Windows
      // separator (even in relative paths or after %5C). Ignore ambiguous
      // destinations rather than offering an action for a different file.
      // Encoded destinations, doubled backslashes and @references still work.
      if (/(^|[^\\])\\[`*{}\[\]()#+\-.!_>&]/u.test(value) ||
        (/(^|[^\\])\\ /u.test(value) && (/^[a-z]:/iu.test(value) || /%5c/iu.test(value)))) return null;
      // Decode entities before percent escapes: %26amp; denotes the literal
      // filename "&amp;", whereas &amp; denotes "&" in rendered Markdown.
      value = decodeMarkdownDestination(value, true);
      if (value === null || value.includes("?") || value.startsWith("//")) return null;
      const hash = value.indexOf("#");
      const fragment = hash < 0 ? "" : value.slice(hash + 1);
      if (fragment && !/^L[1-9]\d*(?:-L[1-9]\d*)?$/u.test(fragment)) return null;
      let path;
      try { path = decodeURIComponent(hash < 0 ? value : value.slice(0, hash)); }
      catch { return null; }
      if (!path || /[\u0000-\u001f\u007f]/u.test(path) || /^[\\/]{2}/u.test(path) ||
        /^[a-z][a-z\d+.-]*:/iu.test(path) && !/^[a-z]:[\\/]/iu.test(path)) return null;
      return path;
    }

    function basename(path) {
      return path.split(/[\\/]/u).filter(Boolean).at(-1) || path;
    }
    function parentPath(path) {
      const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      return index < 0 ? "." : path.slice(0, index) || "/";
    }

    function decodeMarkdownDestination(value, local = false) {
      // Decode in one pass: a backslash-escaped ampersand is literal, not the
      // start of an entity. Unknown entities are skipped rather than mislinked.
      const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: "\u00a0" };
      let decoded = "";
      for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === "\\" && index + 1 < value.length) {
          const next = value[index + 1];
          const code = next.charCodeAt(0);
          const punctuation = (code >= 33 && code <= 47) || (code >= 58 && code <= 64) ||
            (code >= 91 && code <= 96) || (code >= 123 && code <= 126);
          if (local ? /[\\`*{}\[\]()#+\-.!_> ]/u.test(next) : punctuation) {
            decoded += next;
            index++;
            continue;
          }
        }
        if (char === "&") {
          const entity = /^&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z\d]+);/iu.exec(value.slice(index));
          if (entity) {
            let replacement;
            if (entity[1].startsWith("#")) {
              const hex = entity[1][1]?.toLowerCase() === "x";
              const code = Number.parseInt(entity[1].slice(hex ? 2 : 1), hex ? 16 : 10);
              if (!Number.isInteger(code) || !code || code > 0x10ffff ||
                (code >= 0xd800 && code <= 0xdfff)) return null;
              replacement = String.fromCodePoint(code);
            } else replacement = named[entity[1].toLowerCase()];
            if (replacement === undefined) return null;
            decoded += replacement;
            index += entity[0].length - 1;
            continue;
          }
        }
        decoded += char;
      }
      return decoded;
    }

    function webDestination(value) {
      if (!/^https?:\/\//iu.test(value) || /[\s\u0000-\u001f\u007f\\<>]/u.test(value)) return null;
      try {
        const parsed = new window.URL(value);
        if (!(["http:", "https:"].includes(parsed.protocol) && parsed.hostname) ||
          parsed.username || parsed.password || /[\s\u0000-\u001f\u007f\\<>]/u.test(parsed.href)) return null;
        return { url: parsed.href, host: parsed.host };
      } catch { return null; }
    }

    function extractTextCandidates(texts, includeWeb = true) {
      const seen = new Set();
      const result = [];
      const addFile = (path, kind) => {
        if (!path || path.endsWith("/") || path.endsWith("\\")) return;
        const key = `file:${path.replace(/\\/gu, "/")}`;
        if (seen.has(key) || result.length >= MAX_FILES) return;
        seen.add(key);
        result.push({ type: "file", path, kind, name: basename(path) });
      };
      const addWeb = (link, label) => {
        if (!link || seen.has(`web:${link.url}`) || result.length >= MAX_FILES) return;
        seen.add(`web:${link.url}`);
        result.push({ type: "web", ...link, name: label || link.host });
      };
      for (const source of texts) {
        if (result.length >= MAX_FILES) break;
        const text = withoutCode(String(source).slice(0, MAX_TEXT));
        const found = [];
        // Only explicit Markdown destinations; not plain URLs or tool-result prose.
        for (const link of markdownLinks(text)) found.push({ ...link, type: "markdown" });
        // Match the same @"space name" / @path token shapes as ReferenceText.
        const references = /(^|\s)(@"[^"\n]+"|@[^\s]+)/gu;
        let match;
        while ((match = references.exec(text)) !== null) found.push({ index: match.index + match[1].length,
          type: "reference", label: match[2] });
        found.sort((a, b) => a.index - b.index);
        for (const item of found) {
          if (result.length >= MAX_FILES) break;
          if (item.type === "markdown") {
            const decoded = decodeMarkdownDestination(item.destination);
            if (/^https?:\/\//iu.test(decoded || item.destination)) {
              if (includeWeb && decoded) addWeb(webDestination(decoded), item.label);
            } else addFile(localDestination(item.destination), "markdown");
          } else {
            const path = item.label.startsWith('@"') ? item.label.slice(2, -1) :
              item.label.slice(1).replace(/[.,;:!?)}\]]+$/u, "");
            if (path && !/[\u0000-\u001f\u007f]/u.test(path)) addFile(path, "reference");
          }
        }
      }
      return result;
    }

    function extractFileCandidates(texts) {
      return extractTextCandidates(texts, false);
    }

    function extractTurnCandidates(sources) {
      const keyOf = (item) => item.type === "web" ? `web:${item.url}` :
        `file:${item.path.replace(/\\/gu, "/")}`;
      // Reserve room for successful file edits even if an earlier prompt lists
      // hundreds of links. Keep original order within the accepted resources.
      const pendingEdits = new Set();
      for (const source of sources) if (source.type === "edited-file" && pendingEdits.size < MAX_FILES)
        pendingEdits.add(keyOf({ type: "file", path: source.path }));
      const seen = new Map();
      const result = [];
      for (const source of sources) {
        if (result.length >= MAX_FILES && source.type === "text") continue;
        const items = source.type === "text" ? extractTextCandidates([source.text]) :
          source.type === "edited-file" ? [{ type: "file", path: source.path,
            name: basename(source.path), kind: "edited", edited: true, created: source.created }] : [];
        for (const item of items) {
          const key = keyOf(item);
          pendingEdits.delete(key);
          const index = seen.get(key);
          if (index !== undefined) {
            if (item.edited) result[index] = { ...result[index], edited: true,
              created: result[index].created || item.created };
          } else if (result.length < MAX_FILES - pendingEdits.size) {
            seen.set(key, result.length);
            result.push(item);
          }
        }
      }
      return result;
    }

    function preserveEntityAmpersand(value) {
      return value.replace(/&(?=(?:#(?:x[0-9a-f]+|\d+)|[a-z][a-z\d]+);)/giu, "&#38;");
    }

    function copyMarkdown(path, label) {
      const destination = encodeURI(path).replace(/[&?#<>\s]/gu, (char) => encodeURIComponent(char));
      const caption = preserveEntityAmpersand(label.replace(/\\/gu, "\\\\").replace(/([\[\]])/gu, "\\$1"));
      return `[${caption}](<${destination}>)`;
    }

    function copyWebMarkdown(url, label) {
      const caption = preserveEntityAmpersand(label.replace(/\\/gu, "\\\\").replace(/([\[\]])/gu, "\\$1"));
      // An entity-like substring of the actual URL must survive Markdown's
      // one-pass entity decoder without changing query delimiters.
      const destination = preserveEntityAmpersand(url);
      return `[${caption}](<${destination}>)`;
    }

    function unwrap(result, label) {
      if (!result?.ok) throw new Error(result?.error?.message || label);
      return result.value;
    }

    function panelPosition(element) {
      const rect = element?.getBoundingClientRect();
      if (!rect) return { left: 8, top: 8 };
      const width = Math.min(380, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      return rect.top > 180 ? { left, bottom: window.innerHeight - rect.top + 8,
        maxHeight: Math.max(80, Math.min(window.innerHeight * .55, rect.top - 16)) } :
        { left, top: rect.bottom + 8,
          maxHeight: Math.max(80, Math.min(window.innerHeight * .55, window.innerHeight - rect.bottom - 16)) };
    }

    function SettingsPage({ view, form, locale }) {
      const { t } = useText(locale);
      const state = form?.state;
      const saved = readSettings(state?.value);
      const [draft, setDraft] = React.useState(saved);
      const [notice, setNotice] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const changeDraft = (update) => { setNotice(""); setDraft(update); };
      React.useEffect(() => {
        setDraft(readSettings(state?.value));
      }, [state?.revision, state?.status]);
      if (view === "summary") return h("span", null, t(saved.copyActions.length === 1 ? "summaryOne" : "summaryMany", {
        mode: t(saved.openMode === "sidebar" ? "sidebar" : "systemApp"),
        count: saved.copyActions.length
      }));
      const writable = state?.status === "ready" && state.writable && state.mode === "host" &&
        typeof form?.mutate === "function";
      const ordered = [...draft.copyActions,
        ...DEFAULT_COPY_ACTIONS.filter((id) => !draft.copyActions.includes(id))];
      const toggle = (id) => changeDraft((previous) => ({ ...previous,
        copyActions: previous.copyActions.includes(id) ?
          previous.copyActions.filter((item) => item !== id) : [...previous.copyActions, id] }));
      const move = (id, delta) => changeDraft((previous) => {
        const items = [...previous.copyActions];
        const index = items.indexOf(id);
        const next = index + delta;
        if (index < 0 || next < 0 || next >= items.length) return previous;
        [items[index], items[next]] = [items[next], items[index]];
        return { ...previous, copyActions: items };
      });
      const save = async () => {
        if (!writable || busy) return;
        setBusy(true);
        setNotice("");
        try {
          const accepted = await form.mutate([
            { op: "set", path: ["openMode"], value: draft.openMode },
            { op: "set", path: ["copyActions"], value: draft.copyActions }
          ], state.revision);
          setNotice(accepted ? "settingsSaved" : "settingsStale");
        } catch { setNotice("settingsSaveFailed"); }
        finally { setBusy(false); }
      };
      return h("div", { className: "dtfa-settings" },
        !writable ? h("p", { className: "dtfa-settings-status", role: "status" },
          t(state?.status === "loading" ? "settingsLoading" : "settingsUnsupported")) : null,
        h("fieldset", { disabled: !writable || busy },
          h("legend", null, t("settingsOpenLegend")),
          ...[["system", "systemChoice"], ["sidebar", "sidebarChoice"]].map(([id, label]) =>
            h("label", { key: id, className: "dtfa-settings-choice" },
              h("input", { type: "radio", name: "dtfa-open-mode", value: id,
                checked: draft.openMode === id,
                onChange: () => changeDraft((previous) => ({ ...previous, openMode: id })) }), t(label)))),
        h("fieldset", { disabled: !writable || busy },
          h("legend", null, t("settingsCopyLegend")),
          ...ordered.map((id) => {
            const index = draft.copyActions.indexOf(id);
            return h("div", { className: "dtfa-settings-item", key: id },
              h("label", { className: "dtfa-settings-choice" },
                h("input", { type: "checkbox", checked: index >= 0, onChange: () => toggle(id) }),
                copyLabel(t, id)),
              index >= 0 ? h("span", null,
                h("button", { type: "button", disabled: index === 0,
                  "aria-label": t("moveUp", { label: copyLabel(t, id) }),
                  onClick: () => move(id, -1) }, "↑"),
                h("button", { type: "button", disabled: index === draft.copyActions.length - 1,
                  "aria-label": t("moveDown", { label: copyLabel(t, id) }),
                  onClick: () => move(id, 1) }, "↓")) : null);
          })),
        h("p", { className: "dtfa-settings-hint" }, t("settingsHint")),
        h("button", { type: "button", className: "dtfa-settings-save", disabled: !writable || busy,
          onClick: () => { void save(); } }, t(busy ? "saving" : "saveSettings")),
        notice ? h("p", { className: "dtfa-settings-status", role: "status" }, t(notice)) : null);
    }

    function TurnFilesAction({ messageId, sessionId, useChat, remote, form, getSidebarRight, locale }) {
      const { t } = useText(locale);
      const sources = useChat((snapshot) => collectTurnSources(snapshot, messageId), sameSources);
      const resources = React.useMemo(() => extractTurnCandidates(sources), [sources]);
      const [open, setOpen] = React.useState(false);
      const [rows, setRows] = React.useState([]);
      const [expanded, setExpanded] = React.useState(null);
      const [feedback, setFeedback] = React.useState(null);
      const [position, setPosition] = React.useState({ left: 8, top: 8 });
      const trigger = React.useRef(null);
      const panel = React.useRef(null);
      const [subscribeSettings, readSnapshot] = React.useMemo(() => form ?
        [form.subscribe.bind(form), form.getSnapshot.bind(form)] : [noFormSubscribe, noFormSnapshot], [form]);
      const settingsState = React.useSyncExternalStore(subscribeSettings, readSnapshot, readSnapshot);
      const settings = readSettings(settingsState.value);
      const settingsReady = !form || settingsState.status === "ready";
      const key = resources.map((item) => `${item.type}:${item.path || item.url}`).join("\u0000");

      React.useEffect(() => {
        if (!open || !resources.length) return;
        let alive = true;
        const abort = new AbortController();
        const verified = resources.map((item) => item.type === "file" ? { ...item, loading: true } : item);
        const fileIndexes = resources.flatMap((item, index) => item.type === "file" ? [index] : []);
        setRows(verified);
        setExpanded(null);
        let next = 0;
        let completed = 0;
        const worker = async () => {
          while (!abort.signal.aborted && next < fileIndexes.length) {
            const index = fileIndexes[next++];
            const file = resources[index];
            try {
              const value = unwrap(await remote.workspaceFiles.stat(sessionId, file.path, abort.signal), t("verifyFailed"));
              if (!value?.absolutePath) {
                const error = new Error(t("absoluteUnknown"));
                error.localeKey = "absoluteUnknown";
                throw error;
              }
              verified[index] = { ...file, absolutePath: value.absolutePath };
            } catch (error) {
              verified[index] = { ...file, error: {
                key: error?.localeKey || "fileUnavailable", detail: error?.message
              } };
            }
            completed++;
            if (alive && (completed % MAX_STAT_CONCURRENCY === 0 || completed === fileIndexes.length))
              setRows([...verified]);
          }
        };
        Promise.all(Array.from({ length: Math.min(MAX_STAT_CONCURRENCY, fileIndexes.length) }, worker)).then(() => {
          if (!alive) return;
          const seen = new Set();
          setRows(verified.filter((item) => {
            if (item.type !== "file" || !item.absolutePath) return true;
            if (seen.has(item.absolutePath)) return false;
            seen.add(item.absolutePath);
            return true;
          }));
        });
        return () => { alive = false; abort.abort(); };
      }, [open, key, sessionId, remote]);

      React.useEffect(() => {
        if (!open) return;
        panel.current?.focus();
        const close = (restoreFocus) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
        const outside = (event) => {
          if (!trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) close(false);
        };
        const escape = (event) => {
          if (event.key === "Escape" &&
            (panel.current?.contains(event.target) || trigger.current?.contains(event.target))) {
            event.preventDefault();
            close(true);
          }
        };
        const move = () => setPosition(panelPosition(trigger.current));
        document.addEventListener("pointerdown", outside, true);
        document.addEventListener("keydown", escape, true);
        window.addEventListener("resize", move);
        window.addEventListener("scroll", move, true);
        return () => {
          document.removeEventListener("pointerdown", outside, true);
          document.removeEventListener("keydown", escape, true);
          window.removeEventListener("resize", move);
          window.removeEventListener("scroll", move, true);
        };
      }, [open]);

      if (!resources.length) return null;
      const act = async (file, action) => {
        if (file.type === "web") {
          setFeedback(null);
          try {
            const text = action === "web-url" ? file.url :
              action === "web-markdown" ? copyWebMarkdown(file.url, file.name) : null;
            if (!text) return;
            if (!navigator.clipboard?.writeText) {
              setFeedback({ key: "clipboardUnavailable" });
              return;
            }
            await navigator.clipboard.writeText(text);
            setFeedback({ key: "copied" });
          } catch (error) { setFeedback({ key: "actionFailed", detail: error?.message }); }
          return;
        }
        if (!file.absolutePath) return;
        setFeedback(null);
        try {
          if (action === "sidebar") {
            const sidebar = getSidebarRight?.();
            if (!sidebar?.openResource || sidebar.mounted?.getSnapshot?.() !== sessionId) {
              setFeedback({ key: "sidebarUnavailable" });
              return;
            }
            sidebar.openResource(sessionFileAddress(sessionId, file.absolutePath));
            setFeedback({ key: "sidebarRequested" });
          } else if (action === "open" || action === "reveal") {
            unwrap(await remote.session.openWorkspacePath({ path: file.absolutePath,
              ...(action === "reveal" ? { action: "reveal" } : {}) }),
            t(action === "reveal" ? "revealFailed" : "openFailed"));
            setFeedback({ key: action === "reveal" ? "revealRequested" : "openRequested" });
          } else {
            const text = action === "path" ? file.absolutePath : action === "name" ?
              basename(file.absolutePath) : copyMarkdown(file.absolutePath, file.name);
            if (!navigator.clipboard?.writeText) {
              setFeedback({ key: "clipboardUnavailable" });
              return;
            }
            await navigator.clipboard.writeText(text);
            setFeedback({ key: "copied" });
          }
        } catch (error) {
          setFeedback({ key: action === "reveal" ? "revealFailed" :
            action === "open" ? "openFailed" : "actionFailed", detail: error?.message });
        }
      };
      // File actions run on the DSH Host, whose OS may differ from this browser's OS.
      const fileManagerLabel = t("fileManager");
      const nameCounts = new Map();
      for (const file of rows) if (file.type === "file")
        nameCounts.set(file.name, (nameCounts.get(file.name) || 0) + 1);
      const webRow = (link, index) => {
        const rowKey = `web:${link.url}`;
        const moreId = `dtfa-more-${index}-${messageId}`;
        const moreOpen = expanded === rowKey;
        const moreButton = (action, label) => h("button", { type: "button",
          className: "dtfa-more-action", onClick: () => { void act(link, action); }
        }, label);
        return h("div", { className: "dtfa-row", key: rowKey, title: link.url },
          h("div", { className: "dtfa-row-main" },
            h("a", { className: "dtfa-open", href: link.url, target: "_blank",
              rel: "noopener noreferrer", title: t("browserTitle", { url: link.url }),
              "aria-label": t("browserAria", { name: link.name, host: link.host })
            }, h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
              strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
            h("path", { d: "M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.9 5.03M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13.1 18.97" })),
            h("span", { className: "dtfa-name" }, link.name),
            link.name !== link.host ? h("span", { className: "dtfa-link-host" }, link.host) : null),
            h("button", { type: "button", className: "dtfa-icon", title: t("more"),
              "aria-label": t("moreWebAria", { name: link.name, host: link.host }), "aria-expanded": moreOpen,
              "aria-controls": moreId, onClick: () => setExpanded(moreOpen ? null : rowKey)
            }, h(IconEllipsisOutlineRegular, { "aria-hidden": true }))),
          moreOpen ? h("div", { className: "dtfa-more-actions", id: moreId },
            moreButton("web-url", t("copyUrl")), moreButton("web-markdown", t("copyMarkdown"))) : null);
      };
      const compactRow = (file, index) => {
        const path = file.absolutePath || file.path;
        const actionName = nameCounts.get(file.name) > 1 ?
          t("duplicateName", { name: file.name, parent: parentPath(path) }) : file.name;
        const moreId = `dtfa-more-${index}-${messageId}`;
        const moreOpen = expanded === file.path;
        const showSystemOpen = settings.openMode === "sidebar" || !settingsReady;
        const showMore = showSystemOpen || settings.copyActions.length > 0;
        const moreButton = (action, label, tooltip) => h("button", {
          type: "button", className: "dtfa-more-action", title: tooltip || label,
          onClick: () => { void act(file, action); }
        }, label);
        return h("div", { className: "dtfa-row", key: file.path, title: path },
          h("div", { className: "dtfa-row-main" },
            h("button", { type: "button", className: "dtfa-open", disabled: !file.absolutePath || !settingsReady,
              "aria-label": t("openFileAria", { mode: t(settings.openMode === "sidebar" ? "openInSidebar" : "openVerb"),
                name: actionName }),
              title: file.absolutePath ? t("openFileTitle", {
                mode: t(settings.openMode === "sidebar" ? "sidebarChoice" : "openVerb"),
                path: file.absolutePath }) : undefined,
              onClick: () => { void act(file, settings.openMode === "sidebar" ? "sidebar" : "open"); }
            }, h(FileTypeIcon, { path, size: 16 }), h("span", { className: "dtfa-name" }, file.name),
            file.edited ? h("span", { className: "dtfa-link-host",
              title: t(file.created ? "createdHint" : "editedHint") }, t(file.created ? "created" : "edited")) : null),
            file.loading ? h("span", { className: "dtfa-progress", title: t("verifying") }, "…") :
              file.error ? null : h(React.Fragment, null,
                h("button", { type: "button", className: "dtfa-icon", title: fileManagerLabel,
                  "aria-label": t("revealAria", { name: actionName }),
                  onClick: () => { void act(file, "reveal"); }
                }, h(IconFolderOpenOutlineRegular, { "aria-hidden": true })),
                showMore ? h("button", { type: "button", className: "dtfa-icon", title: t("more"),
                  "aria-label": t("moreFileAria", { name: actionName }), "aria-expanded": moreOpen,
                  "aria-controls": moreId, onClick: () => setExpanded(moreOpen ? null : file.path)
                }, h(IconEllipsisOutlineRegular, { "aria-hidden": true })) : null
              )
          ),
          file.error ? h("div", { className: "dtfa-parent", role: "status",
            title: file.error.detail || undefined,
            "aria-description": file.error.detail || undefined }, t(file.error.key)) :
            nameCounts.get(file.name) > 1 ? h("div", { className: "dtfa-parent", title: parentPath(path) },
              parentPath(path)) : null,
          showMore && moreOpen && file.absolutePath ? h("div", { className: "dtfa-more-actions", id: moreId },
            ...(showSystemOpen ? [moreButton("open", t("systemOpen"))] : []),
            ...settings.copyActions.map((id) => moreButton(id, copyLabel(t, id),
              id === "markdown" ? t("copyMarkdown") : undefined))) : null);
      };
      const hasFiles = resources.some((item) => item.type === "file");
      const status = feedback ? t(feedback.key) : !settingsReady && hasFiles ?
        t(settingsState.status === "loading" ? "settingsOpening" : "settingsOpeningFailed") :
        resources.length === MAX_FILES ? t("limit", { count: MAX_FILES }) : "";
      const content = h("div", { ref: panel, className: "dtfa-panel", role: "dialog",
        tabIndex: -1, "aria-label": t("resources"), style: position, "data-turn-files-panel": true },
        h("div", { className: "dtfa-heading" },
          h("span", null, t("resources")), h("span", { className: "dtfa-heading-count" }, rows.length)),
        h("div", { className: "dtfa-list", role: "list", "aria-label": t("resourceList") },
          ...rows.map((item, index) => h("div", { role: "listitem",
            key: `${item.type}:${item.path || item.url}` },
            item.type === "web" ? webRow(item, index) : compactRow(item, index)))),
        status && h("p", { className: "dtfa-status", role: "status",
          title: feedback?.detail || undefined,
          "aria-description": feedback?.detail || undefined }, status));
      return h(React.Fragment, null,
        h("button", { type: "button", className: "dtfa-trigger", ref: trigger,
          title: t("resources"), "aria-label": t(resources.length === 1 ? "triggerAriaOne" : "triggerAriaMany",
            { count: resources.length }),
          "aria-expanded": open, "data-turn-files-button": true,
          onClick: () => { setFeedback(null); setPosition(panelPosition(trigger.current)); setOpen(!open); }
        }, h(IconPaperclipOutlineRegular, { "aria-hidden": true }),
          h("span", { className: "dtfa-count" }, resources.length)),
        open ? ReactDOM.createPortal(content, document.body) : null);
    }

    function apply(ctx) {
      const form = ctx.configForms.get(SETTINGS_NS);
      const locale = ctx.locale;
      ctx.effect(() => locale.register(LOCALE_NS, { zh: TEXT.zh, en: TEXT.en }),
        "dsh-chat-file-actions: translations");
      const LocalSettingsPage = (props) => h(SettingsPage, { ...props, locale });
      ctx.slots.inject("plugins.row.config", () =>
        ctx.slots.register({ name: "plugins.row.config", key: "dsh-chat-file-actions#chat-file-actions" }, LocalSettingsPage));
      ctx.slots.inject("conversation.chat.assistant-actions", () =>
        ctx.slots.register({ name: "conversation.chat.assistant-actions", id: "turn-files", order: 70,
          inject: () => ({ remote: ctx.remote, form, locale, getSidebarRight: () => ctx.get("sidebarRight") }) },
        TurnFilesAction));
      ctx.effect(() => {
        const style = document.createElement("style");
        style.dataset.pluginCss = "dsh-chat-file-actions";
        style.textContent = css;
        document.head.append(style);
        return () => style.remove();
      }, "dsh-chat-file-actions: styles");
    }
    exports.name = "dsh-chat-file-actions-client";
    exports.inject = ["slots", "locale", "configForms", "remote", "remote.session", "remote.workspaceFiles"];
    exports.apply = apply;
    exports.readSettings = readSettings;
    exports.sessionFileAddress = sessionFileAddress;
    exports.SettingsPage = SettingsPage;
    exports.extractFileCandidates = extractFileCandidates;
    exports.extractTurnCandidates = extractTurnCandidates;
    exports.collectTurnTexts = collectTurnTexts;
    exports.collectTurnSources = collectTurnSources;
    exports.webDestination = webDestination;
    exports.copyMarkdown = copyMarkdown;
    exports.copyWebMarkdown = copyWebMarkdown;
    exports.TurnFilesAction = TurnFilesAction;
    return module.exports;
  }
});
