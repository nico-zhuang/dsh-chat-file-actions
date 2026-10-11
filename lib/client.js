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
      .dtfa-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
      .dtfa-trigger:focus-visible, .dtfa-panel button:focus-visible, .dtfa-panel:focus-visible {
        outline:2px solid var(--dsw-alias-brand-primary,#4774cc); outline-offset:2px; }
    `;

    function textBlocks(blocks) {
      if (!Array.isArray(blocks)) return [];
      return blocks.filter((block) => block && (block.kind === "text" || block.type === "text") &&
        typeof block.text === "string").map((block) => block.text);
    }

    // The action slot belongs to the final Assistant message of one Turn. Use
    // its durable message id to locate that Turn, never the selected workspace or
    // whichever other conversation is currently in focus.
    function collectTurnTexts(snapshot, messageId) {
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
          result.push(...textBlocks(node.data?.content));
        } else if (node.kind === "assistant-step" && node.data?.finalNode &&
          node.data.finalNode.seq <= through) {
          result.push(...textBlocks(node.data.blocks));
        }
      }
      return result;
    }

    function sameTexts(left, right) {
      return left.length === right.length && left.every((text, index) => text === right[index]);
    }

    // Mask code spans/fences, indented code and HTML comments: examples and
    // comments are not clickable local-file links in the settled Markdown UI.
    function withoutCode(text) {
      let fence = null;
      let inline = 0;
      let comment = false;
      return text.split(/(\n)/u).map((line) => {
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

    function localDestination(value) {
      if (!value) return null;
      // A lone backslash before Markdown punctuation could also be a Windows
      // separator (even in relative paths or after %5C). Ignore ambiguous
      // destinations rather than offering an action for a different file.
      // Encoded destinations, doubled backslashes and @references still work.
      if (/(^|[^\\])\\[`*{}\[\]()#+\-.!_>]/u.test(value) ||
        (/(^|[^\\])\\ /u.test(value) && (/^[a-z]:/iu.test(value) || /%5c/iu.test(value)))) return null;
      // Markdown backslash escapes in bare destinations are syntax, not part of
      // the filename; do not feed them to basename() or workspaceFiles.stat().
      value = value.replace(/\\([\\`*{}\[\]()#+\-.!_> ])/gu, "$1");
      if (value.includes("?") || value.startsWith("//")) return null;
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

    function extractFileCandidates(texts) {
      const seen = new Set();
      const result = [];
      const add = (path, kind) => {
        if (!path || path.endsWith("/") || path.endsWith("\\")) return;
        const key = path.replace(/\\/gu, "/");
        if (seen.has(key) || result.length >= MAX_FILES) return;
        seen.add(key);
        result.push({ path, kind, name: basename(path) });
      };
      for (const source of texts) {
        if (result.length >= MAX_FILES) break;
        const text = withoutCode(String(source).slice(0, MAX_TEXT));
        // Match the local destinations recognized by DSH's MarkdownFileLink.
        const markdown = /!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|((?:\\.|[^)\s])+))(?:\s+["'][^"'\n]*["'])?\s*\)/gu;
        let match;
        while ((match = markdown.exec(text)) !== null) add(localDestination(match[1] ?? match[2]), "markdown");
        // Match the same @"space name" / @path token shapes as ReferenceText.
        const references = /(^|\s)(@"[^"\n]+"|@[^\s]+)/gu;
        while ((match = references.exec(text)) !== null) {
          const label = match[2];
          const path = label.startsWith('@"') ? label.slice(2, -1) :
            label.slice(1).replace(/[.,;:!?)}\]]+$/u, "");
          if (path && !path.endsWith("/") && !path.endsWith("\\") &&
            !/[\u0000-\u001f\u007f]/u.test(path)) add(path, "reference");
        }
      }
      return result;
    }

    function copyMarkdown(path, label) {
      const destination = encodeURI(path).replace(/[?#<>\s]/gu, (char) => encodeURIComponent(char));
      const caption = label.replace(/\\/gu, "\\\\").replace(/([\[\]])/gu, "\\$1");
      return `[${caption}](<${destination}>)`;
    }

    function unwrap(result, label) {
      if (!result?.ok) throw new Error(result?.error?.message || `${label}失败`);
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

    function TurnFilesAction({ messageId, sessionId, useChat, remote }) {
      const texts = useChat((snapshot) => collectTurnTexts(snapshot, messageId), sameTexts);
      const files = React.useMemo(() => extractFileCandidates(texts), [texts]);
      const [open, setOpen] = React.useState(false);
      const [rows, setRows] = React.useState([]);
      const [expanded, setExpanded] = React.useState(null);
      const [feedback, setFeedback] = React.useState("");
      const [position, setPosition] = React.useState({ left: 8, top: 8 });
      const trigger = React.useRef(null);
      const panel = React.useRef(null);
      const key = files.map((file) => file.path).join("\u0000");

      React.useEffect(() => {
        if (!open || !files.length) return;
        let alive = true;
        const abort = new AbortController();
        const verified = files.map((file) => ({ ...file, loading: true }));
        setRows(verified);
        setExpanded(null);
        let next = 0;
        let completed = 0;
        const worker = async () => {
          while (!abort.signal.aborted && next < files.length) {
            const index = next++;
            const file = files[index];
            try {
              const value = unwrap(await remote.workspaceFiles.stat(sessionId, file.path, abort.signal), "验证文件");
              if (!value?.absolutePath) throw new Error("无法确定文件绝对路径");
              verified[index] = { ...file, absolutePath: value.absolutePath };
            } catch (error) { verified[index] = { ...file, error: error?.message || "文件不可用" }; }
            completed++;
            if (alive && (completed % MAX_STAT_CONCURRENCY === 0 || completed === files.length))
              setRows([...verified]);
          }
        };
        Promise.all(Array.from({ length: Math.min(MAX_STAT_CONCURRENCY, files.length) }, worker)).then(() => {
          if (!alive) return;
          const seen = new Set();
          setRows(verified.filter((file) => {
            if (!file.absolutePath) return true;
            if (seen.has(file.absolutePath)) return false;
            seen.add(file.absolutePath);
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

      if (!files.length) return null;
      const act = async (file, action) => {
        if (!file.absolutePath) return;
        setFeedback("");
        try {
          if (action === "open" || action === "reveal") {
            unwrap(await remote.session.openWorkspacePath({ path: file.absolutePath,
              ...(action === "reveal" ? { action: "reveal" } : {}) }), action === "reveal" ? "显示文件" : "打开文件");
            setFeedback(action === "reveal" ? "已请求系统定位文件" : "已请求系统打开文件");
          } else {
            const text = action === "path" ? file.absolutePath : action === "name" ?
              basename(file.absolutePath) : copyMarkdown(file.absolutePath, file.name);
            if (!navigator.clipboard?.writeText) throw new Error("此窗口不能写入剪贴板");
            await navigator.clipboard.writeText(text);
            setFeedback("已复制");
          }
        } catch (error) { setFeedback(error?.message || "操作失败"); }
      };
      // File actions run on the DSH Host, whose OS may differ from this browser's OS.
      const fileManagerLabel = "在文件管理器中显示";
      const nameCounts = new Map();
      for (const file of rows) nameCounts.set(file.name, (nameCounts.get(file.name) || 0) + 1);
      const compactRow = (file, index) => {
        const path = file.absolutePath || file.path;
        const actionName = nameCounts.get(file.name) > 1 ? `${file.name}（${parentPath(path)}）` : file.name;
        const moreId = `dtfa-more-${index}-${messageId}`;
        const moreOpen = expanded === file.path;
        const copyButton = (action, label, tooltip) => h("button", {
          type: "button", className: "dtfa-more-action", title: tooltip || label,
          onClick: () => { void act(file, action); }
        }, label);
        return h("div", { className: "dtfa-row", key: file.path, title: path },
          h("div", { className: "dtfa-row-main" },
            h("button", { type: "button", className: "dtfa-open", disabled: !file.absolutePath,
              "aria-label": `打开 ${actionName}`, title: file.absolutePath ? `打开：${file.absolutePath}` : undefined,
              onClick: () => { void act(file, "open"); }
            }, h(FileTypeIcon, { path, size: 16 }), h("span", { className: "dtfa-name" }, file.name)),
            file.loading ? h("span", { className: "dtfa-progress", title: "正在验证文件" }, "…") :
              file.error ? null : h(React.Fragment, null,
                h("button", { type: "button", className: "dtfa-icon", title: fileManagerLabel,
                  "aria-label": `${fileManagerLabel}：${actionName}`,
                  onClick: () => { void act(file, "reveal"); }
                }, h(IconFolderOpenOutlineRegular, { "aria-hidden": true })),
                h("button", { type: "button", className: "dtfa-icon", title: "更多操作",
                  "aria-label": `更多操作：${actionName}`, "aria-expanded": moreOpen,
                  "aria-controls": moreId, onClick: () => setExpanded(moreOpen ? null : file.path)
                }, h(IconEllipsisOutlineRegular, { "aria-hidden": true }))
              )
          ),
          file.error ? h("div", { className: "dtfa-parent", role: "status" }, `不可用：${file.error}`) :
            nameCounts.get(file.name) > 1 ? h("div", { className: "dtfa-parent", title: parentPath(path) },
              parentPath(path)) : null,
          moreOpen && file.absolutePath ? h("div", { className: "dtfa-more-actions", id: moreId },
            copyButton("path", "复制路径"), copyButton("name", "复制文件名"),
            copyButton("markdown", "复制链接", "复制 Markdown 链接")) : null);
      };
      const status = feedback || (files.length === MAX_FILES ? `最多展示前 ${MAX_FILES} 个文件` : "");
      const content = h("div", { ref: panel, className: "dtfa-panel", role: "dialog",
        tabIndex: -1, "aria-label": "本轮文件", style: position, "data-turn-files-panel": true },
        h("div", { className: "dtfa-heading" },
          h("span", null, "本轮文件"), h("span", { className: "dtfa-heading-count" }, rows.length)),
        h("div", { className: "dtfa-list", role: "list", "aria-label": "文件列表" },
          ...rows.map((file, index) => h("div", { role: "listitem", key: file.path }, compactRow(file, index)))),
        status && h("p", { className: "dtfa-status", role: "status" }, status));
      return h(React.Fragment, null,
        h("button", { type: "button", className: "dtfa-trigger", ref: trigger,
          title: "本轮文件", "aria-label": `本轮文件，${files.length} 个候选`,
          "aria-expanded": open, "data-turn-files-button": true,
          onClick: () => { setFeedback(""); setPosition(panelPosition(trigger.current)); setOpen(!open); }
        }, h(IconPaperclipOutlineRegular, { "aria-hidden": true }),
          h("span", { className: "dtfa-count" }, files.length)),
        open ? ReactDOM.createPortal(content, document.body) : null);
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.chat.assistant-actions", () =>
        ctx.slots.register({ name: "conversation.chat.assistant-actions", id: "turn-files", order: 70,
          inject: () => ({ remote: ctx.remote }) }, TurnFilesAction));
      ctx.effect(() => {
        const style = document.createElement("style");
        style.dataset.pluginCss = "dsh-chat-file-actions";
        style.textContent = css;
        document.head.append(style);
        return () => style.remove();
      }, "dsh-chat-file-actions: styles");
    }
    exports.name = "dsh-chat-file-actions-client";
    exports.inject = ["slots", "remote", "remote.session", "remote.workspaceFiles"];
    exports.apply = apply;
    exports.extractFileCandidates = extractFileCandidates;
    exports.collectTurnTexts = collectTurnTexts;
    exports.copyMarkdown = copyMarkdown;
    exports.TurnFilesAction = TurnFilesAction;
    return module.exports;
  }
});
