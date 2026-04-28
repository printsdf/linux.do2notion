// ==UserScript==
// @name         Linux.do 混合导出 Markdown / Notion
// @namespace    https://linux.do/
// @version      0.1.0
// @description  以更自然的文档流导出 Linux.do 帖子，支持下载 Notion 友好的 Markdown，或直接导出到 Notion 页面，优先使用高清原图
// @author       Codex
// @match        https://linux.do/t/*
// @match        https://linux.do/t/topic/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.notion.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORE = {
    TARGET: "ld_hybrid_target",
    FLOOR_MODE: "ld_hybrid_floor_mode",
    RANGE_START: "ld_hybrid_range_start",
    RANGE_END: "ld_hybrid_range_end",
    ONLY_FIRST: "ld_hybrid_only_first",
    ONLY_OP: "ld_hybrid_only_op",
    NOTION_API_KEY: "ld_hybrid_notion_api_key",
    NOTION_PAGE_ID: "ld_hybrid_notion_page_id",
    NOTION_CONFIG_SAVED: "ld_hybrid_notion_config_saved",
  };

  const DEFAULTS = {
    target: "markdown",
    floorMode: "all",
    rangeStart: 1,
    rangeEnd: 999999,
    onlyFirst: false,
    onlyOp: false,
    notionApiKey: "",
    notionPageId: "",
  };

  const NOTION_RICH_TEXT_LIMIT = 1800;
  const NOTION_VERSION = "2022-06-28";
  const IMAGE_EMOJI_RE = /\/images\/emoji\/(?:twemoji|apple|google|twitter)\/([^/.]+)\.png/i;

  function injectStyles() {
    if (document.getElementById("ld-hybrid-export-styles")) return;
    const style = document.createElement("style");
    style.id = "ld-hybrid-export-styles";
    style.textContent = `
      .ld-hybrid-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--primary-low, #e9e9e9);
        background: transparent;
        color: var(--primary-high, #222);
        cursor: pointer;
        font-size: 0.85em;
        font-weight: 500;
        margin-right: 8px;
        transition: all 0.2s ease;
      }
      .ld-hybrid-btn:hover {
        background: var(--primary-low, #e9e9e9);
        color: var(--primary, #000);
      }
      .ld-hybrid-floating-btn {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 99997;
        background: var(--secondary, #fff);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
      }
      .ld-hybrid-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(4px);
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: ld-hybrid-fade-in 0.2s ease-out;
      }
      .ld-hybrid-modal {
        background: var(--secondary, #fff);
        color: var(--primary, #222);
        border-radius: 12px;
        padding: 24px;
        width: 440px;
        max-width: 92vw;
        max-height: 88vh;
        overflow: auto;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
        border: 1px solid var(--primary-low, #e9e9e9);
        animation: ld-hybrid-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: var(--font-family, system-ui, -apple-system, sans-serif);
      }
      .ld-hybrid-modal h3 {
        margin: 0 0 18px;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ld-hybrid-group {
        margin-bottom: 14px;
      }
      .ld-hybrid-group label {
        display: block;
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .ld-hybrid-control,
      .ld-hybrid-input,
      .ld-hybrid-textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 6px;
        background: var(--secondary, #fff);
        color: var(--primary, #222);
        border: 1px solid var(--primary-medium, #919191);
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .ld-hybrid-control:focus,
      .ld-hybrid-input:focus,
      .ld-hybrid-textarea:focus {
        border-color: var(--tertiary, #0088cc);
        box-shadow: 0 0 0 2px var(--tertiary-low, rgba(0, 136, 204, 0.2));
      }
      .ld-hybrid-hint {
        margin-top: 6px;
        font-size: 0.8rem;
        color: var(--primary-medium, #919191);
        line-height: 1.5;
      }
      .ld-hybrid-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 22px;
      }
      .ld-hybrid-inline-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
      }
      .ld-hybrid-config-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .ld-hybrid-range-fields {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ld-hybrid-range-fields span {
        color: var(--primary-medium, #666);
        font-size: 0.9rem;
        white-space: nowrap;
      }
      .ld-hybrid-checkline {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 0.92rem;
      }
      .ld-hybrid-checkline input[type="checkbox"] {
        accent-color: var(--tertiary, #0088cc);
      }
      .ld-hybrid-config-title {
        font-size: 0.92rem;
        font-weight: 600;
        color: var(--primary-high, #222);
      }
      .ld-hybrid-config-body {
        margin-top: 4px;
      }
      .ld-hybrid-btn2 {
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 0.95rem;
        cursor: pointer;
        border: none;
        font-weight: 600;
        transition: all 0.2s;
      }
      .ld-hybrid-btn-cancel {
        background: transparent;
        color: var(--primary-high, #222);
        border: 1px solid var(--primary-low, #e9e9e9);
      }
      .ld-hybrid-btn-cancel:hover {
        background: var(--primary-low, #e9e9e9);
      }
      .ld-hybrid-btn-primary {
        background: var(--tertiary, #0088cc);
        color: var(--secondary, #fff);
      }
      .ld-hybrid-btn-primary:hover {
        filter: brightness(0.92);
      }
      .ld-hybrid-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ld-hybrid-btn-secondary {
        background: var(--primary-low, #f2f2f2);
        color: var(--primary-high, #222);
        border: 1px solid var(--primary-low, #e9e9e9);
      }
      .ld-hybrid-btn-secondary:hover {
        filter: brightness(0.98);
      }
      .ld-hybrid-status {
        min-height: 20px;
        margin-top: 12px;
        font-size: 0.85rem;
        color: var(--primary-medium, #919191);
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .ld-hybrid-section {
        padding: 12px 14px;
        border-radius: 8px;
        background: var(--primary-low, rgba(0, 0, 0, 0.03));
        margin-top: 6px;
      }
      .ld-hybrid-hidden {
        display: none;
      }
      .ld-hybrid-saved {
        font-size: 0.8rem;
        color: var(--success, #009900);
      }
      @keyframes ld-hybrid-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ld-hybrid-slide-up {
        from { opacity: 0; transform: translateY(18px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  function getTopicId() {
    const m =
      window.location.pathname.match(/\/topic\/(\d+)/) ||
      window.location.pathname.match(/\/t\/(?:[^/]+\/)?(\d+)/);
    return m ? m[1] : null;
  }

  function getTopicTitle() {
    const el = document.querySelector("h1.fancy-title, h1[data-topic-id], .topic-title h1, .fancy-title");
    return el ? el.textContent.trim() : `topic-${getTopicId()}`;
  }

  function safeFilename(name) {
    return String(name || "linuxdo-export")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 120);
  }

  function absoluteUrl(src) {
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    if (src.startsWith("//")) return window.location.protocol + src;
    if (src.startsWith("/")) return window.location.origin + src;
    return window.location.origin + "/" + src.replace(/^\.?\//, "");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function deepClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function hasVisibleText(text) {
    return /\S/.test(text || "");
  }

  function normalizeTextNodeValue(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ");
  }

  function formatDate(input) {
    if (!input) return "";
    try {
      return new Date(input).toLocaleString("zh-CN", { hour12: false });
    } catch {
      return String(input);
    }
  }

  function sanitizeImageCaption(text) {
    const value = String(text || "").trim();
    if (!value) return "";

    const genericPatterns = [
      /^(image|img|photo|picture|screenshot|screen ?shot)$/i,
      /^(image|img|photo|picture|screenshot|screen ?shot)[-_ ]?\d*$/i,
      /^(图片|图像|配图|截图|屏幕截图)\d*$/u,
      /^image\.(png|jpe?g|gif|webp|bmp|svg)$/i,
    ];

    if (genericPatterns.some((pattern) => pattern.test(value))) {
      return "";
    }

    return value;
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  async function fetchJson(url, opts, retries = 2) {
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (i < retries) await sleep(250 * (i + 1));
      }
    }
    throw lastErr || new Error("fetchJson failed");
  }

  function getRequestOpts() {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    const headers = { "x-requested-with": "XMLHttpRequest" };
    if (csrf) headers["x-csrf-token"] = csrf;
    return { headers };
  }

  async function fetchAllPostsDetailed(topicId, onProgress) {
    const opts = getRequestOpts();

    const idData = await fetchJson(
      `${window.location.origin}/t/${topicId}/post_ids.json?post_number=0&limit=99999`,
      opts
    );
    let postIds = idData.post_ids || [];

    const mainData = await fetchJson(`${window.location.origin}/t/${topicId}.json`, opts);
    const mainFirstPost = mainData?.post_stream?.posts?.[0];
    if (mainFirstPost && !postIds.includes(mainFirstPost.id)) postIds.unshift(mainFirstPost.id);

    const opUsername =
      mainData?.details?.created_by?.username ||
      mainData?.post_stream?.posts?.[0]?.username ||
      "";

    const domCategory = document.querySelector(".badge-category__name")?.textContent?.trim() || "";
    const domTags = Array.from(document.querySelectorAll(".discourse-tag"))
      .map((el) => el.textContent.trim())
      .filter(Boolean);

    const topic = {
      topicId: String(topicId || ""),
      title: mainData?.title ? String(mainData.title) : getTopicTitle(),
      category: domCategory,
      tags: (Array.isArray(mainData?.tags) && mainData.tags.length ? mainData.tags : domTags) || [],
      url: window.location.href,
      opUsername: opUsername || "",
      chunkSize: clampInt(mainData?.chunk_size, 1, 999, 20),
    };

    let allPosts = [];
    for (let i = 0; i < postIds.length; i += 200) {
      const chunk = postIds.slice(i, i + 200);
      const q = chunk.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join("&");
      const data = await fetchJson(
        `${window.location.origin}/t/${topicId}/posts.json?${q}&include_suggested=false`,
        opts
      );
      const posts = data?.post_stream?.posts || [];
      allPosts = allPosts.concat(posts);
      if (typeof onProgress === "function") {
        onProgress(Math.min(i + 200, postIds.length), postIds.length, "拉取帖子数据");
      }
    }

    allPosts.sort((a, b) => a.post_number - b.post_number);
    return { topic, posts: allPosts };
  }

  function clampInt(value, min, max, fallback) {
    const num = parseInt(String(value), 10);
    if (Number.isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function selectPosts(data, settings) {
    let posts = data.posts.slice();
    const floorStart = clampInt(settings.rangeStart, 1, 999999, DEFAULTS.rangeStart);
    const floorEnd = clampInt(settings.rangeEnd, 1, 999999, DEFAULTS.rangeEnd);
    const start = Math.min(floorStart, floorEnd);
    const end = Math.max(floorStart, floorEnd);
    const floorSummaryParts = [];
    let filterSuffix = "";

    if (settings.onlyFirst) {
      posts = posts.filter((post) => (post.post_number || 0) === 1);
      floorSummaryParts.push("仅导出主题首楼");
      filterSuffix = " - 第1楼";
    } else if (settings.floorMode === "range") {
      posts = posts.filter((post) => {
        const number = post.post_number || 0;
        return number >= start && number <= end;
      });
      floorSummaryParts.push(`楼层范围：第 ${start} 至第 ${end} 楼`);
      filterSuffix = ` - 第${start}至${end}楼`;
    } else {
      floorSummaryParts.push("楼层范围：全部楼层");
    }

    if (settings.onlyOp) {
      const op = (data.topic.opUsername || "").toLowerCase();
      if (op) {
        posts = posts.filter((post) => (post.username || "").toLowerCase() === op);
      }
      floorSummaryParts.push("仅导出楼主发言");
      filterSuffix += " - 楼主";
    }

    return {
      posts,
      scopeLabel: floorSummaryParts.join("；"),
      filterLabel: floorSummaryParts.join("；"),
      label: floorSummaryParts.join("；"),
      suffix: filterSuffix,
    };
  }

  const NOTION_LANGUAGES = new Set([
    "abap", "abc", "agda", "arduino", "ascii art", "assembly", "bash", "basic", "bnf", "c", "c#", "c++",
    "clojure", "coffeescript", "coq", "css", "dart", "dhall", "diff", "docker", "ebnf", "elixir", "elm",
    "erlang", "flow", "fortran", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "hcl", "html",
    "idris", "java", "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript",
    "llvm ir", "lua", "makefile", "markdown", "markup", "matlab", "mathematica", "mermaid", "nix",
    "notion formula", "objective-c", "ocaml", "pascal", "perl", "php", "plain text", "powershell",
    "prolog", "protobuf", "purescript", "python", "r", "racket", "reason", "ruby", "rust", "sass",
    "scala", "scheme", "scss", "shell", "smalltalk", "solidity", "sql", "swift", "toml", "typescript",
    "vb.net", "verilog", "vhdl", "visual basic", "webassembly", "xml", "yaml", "java/c/c++/c#",
  ]);

  function normalizeLanguage(lang) {
    if (!lang) return "plain text";
    const lower = String(lang).toLowerCase().trim();
    if (NOTION_LANGUAGES.has(lower)) return lower;

    const aliases = {
      auto: "plain text",
      text: "plain text",
      plaintext: "plain text",
      js: "javascript",
      ts: "typescript",
      py: "python",
      rb: "ruby",
      sh: "shell",
      yml: "yaml",
      md: "markdown",
      cpp: "c++",
      csharp: "c#",
      cs: "c#",
      golang: "go",
      rs: "rust",
      kt: "kotlin",
      jsx: "javascript",
      tsx: "typescript",
      vue: "html",
      svelte: "html",
      dockerfile: "docker",
      makefile: "makefile",
      cmake: "makefile",
      bat: "powershell",
      cmd: "powershell",
      ps1: "powershell",
      zsh: "shell",
      fish: "shell",
      asm: "assembly",
      objc: "objective-c",
      "obj-c": "objective-c",
      "objective c": "objective-c",
      vb: "visual basic",
      vbnet: "vb.net",
      tex: "latex",
    };

    if (aliases[lower]) return aliases[lower];
    if (lower.includes("script")) {
      if (lower.includes("java")) return "javascript";
      if (lower.includes("type")) return "typescript";
      if (lower.includes("coffee")) return "coffeescript";
    }
    return "plain text";
  }

  function getBestImageUrl(img) {
    if (!img) return "";
    const candidates = [];

    const anchor = img.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href") || "";
      if (href && !href.startsWith("#") && !/^javascript:/i.test(href)) {
        candidates.push(href);
      }
    }

    candidates.push(
      img.getAttribute("data-orig-src") || "",
      img.getAttribute("data-full-src") || "",
      img.getAttribute("data-download-href") || "",
      img.getAttribute("data-src") || "",
      img.getAttribute("src") || ""
    );

    for (const candidate of candidates) {
      const full = absoluteUrl(candidate);
      if (!full) continue;
      return full;
    }
    return "";
  }

  function isEmojiImage(img) {
    if (!img) return false;
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    return IMAGE_EMOJI_RE.test(src);
  }

  function getEmojiText(img) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
    const match = src.match(IMAGE_EMOJI_RE);
    if (!match) {
      return img.getAttribute("alt") || img.getAttribute("title") || "";
    }
    const name = match[1];
    const alt = img.getAttribute("alt");
    if (alt && alt !== ":emoji:") return alt;
    return `:${name}:`;
  }

  function makeTextRich(content, annotations = {}, link) {
    return {
      type: "text",
      text: {
        content,
        ...(link ? { link: { url: link } } : {}),
      },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
        ...annotations,
      },
    };
  }

  function collectInlineTokens(node, out, annotations = {}, link = "") {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const rawText = node.nodeValue || "";
      const text = normalizeTextNodeValue(rawText);
      if (hasVisibleText(text)) {
        out.push({
          type: "text",
          rich: makeTextRich(text, annotations, link || undefined),
        });
      } else if (/\s/.test(rawText)) {
        out.push({
          type: "text",
          rich: makeTextRich(" ", annotations, link || undefined),
        });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      out.push({ type: "break" });
      return;
    }

    if (tag === "img") {
      if (isEmojiImage(el)) {
        const emoji = getEmojiText(el);
        if (emoji) {
          out.push({
            type: "text",
            rich: makeTextRich(emoji, annotations, link || undefined),
          });
        }
        return;
      }

      const url = getBestImageUrl(el);
      if (url) {
        out.push({
          type: "image",
          url,
          alt: sanitizeImageCaption(el.getAttribute("alt") || ""),
        });
      }
      return;
    }

    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const classes = el.getAttribute("class") || "";
      if (classes.includes("anchor") || href.startsWith("#")) {
        Array.from(el.childNodes).forEach((child) => collectInlineTokens(child, out, annotations, link));
        return;
      }
      const nextLink = absoluteUrl(href) || link;
      Array.from(el.childNodes).forEach((child) => collectInlineTokens(child, out, annotations, nextLink));
      return;
    }

    if (tag === "strong" || tag === "b") {
      Array.from(el.childNodes).forEach((child) =>
        collectInlineTokens(child, out, { ...annotations, bold: true }, link)
      );
      return;
    }

    if (tag === "em" || tag === "i") {
      Array.from(el.childNodes).forEach((child) =>
        collectInlineTokens(child, out, { ...annotations, italic: true }, link)
      );
      return;
    }

    if (tag === "s" || tag === "del" || tag === "strike") {
      Array.from(el.childNodes).forEach((child) =>
        collectInlineTokens(child, out, { ...annotations, strikethrough: true }, link)
      );
      return;
    }

    if (tag === "code") {
      const text = el.textContent || "";
      if (text) {
        out.push({
          type: "text",
          rich: makeTextRich(text, { ...annotations, code: true }, link || undefined),
        });
      }
      return;
    }

    Array.from(el.childNodes).forEach((child) => collectInlineTokens(child, out, annotations, link));
  }

  function mergeAdjacentRichText(richText) {
    const merged = [];
    for (const item of richText) {
      if (!item?.text?.content) continue;
      const prev = merged[merged.length - 1];
      const sameLink = prev?.text?.link?.url === item?.text?.link?.url;
      const sameAnno = JSON.stringify(prev?.annotations || {}) === JSON.stringify(item?.annotations || {});
      if (prev && sameLink && sameAnno) {
        prev.text.content += item.text.content;
      } else {
        merged.push(deepClone(item));
      }
    }
    return merged;
  }

  function hasRichTextContent(richText) {
    return richText.some((item) => hasVisibleText(item?.text?.content || ""));
  }

  function tokensToParagraphBlocks(tokens) {
    const blocks = [];
    let current = [];

    function flushParagraph() {
      const richText = mergeAdjacentRichText(current);
      if (hasRichTextContent(richText)) {
        blocks.push({
          type: "paragraph",
          paragraph: { rich_text: richText },
        });
      }
      current = [];
    }

    for (const token of tokens) {
      if (token.type === "text") {
        current.push(token.rich);
        continue;
      }
      if (token.type === "break") {
        current.push(makeTextRich("\n"));
        continue;
      }
      if (token.type === "image") {
        flushParagraph();
        blocks.push({
          type: "image",
          image: {
            type: "external",
            external: { url: token.url },
            caption: token.alt ? [makeTextRich(token.alt)] : [],
          },
        });
      }
    }

    flushParagraph();
    return blocks;
  }

  function extractInlineRichText(node, skipNestedLists = false) {
    const tokens = [];

    function collect(nodeToRead, out, annotations = {}, link = "") {
      if (!nodeToRead) return;
      if (
        skipNestedLists &&
        nodeToRead.nodeType === Node.ELEMENT_NODE &&
        ["ul", "ol"].includes(nodeToRead.tagName.toLowerCase())
      ) {
        return;
      }
      collectInlineTokens(nodeToRead, out, annotations, link);
    }

    Array.from(node.childNodes).forEach((child) => collect(child, tokens));

    const richText = [];
    for (const token of tokens) {
      if (token.type === "text") {
        richText.push(token.rich);
      } else if (token.type === "break") {
        richText.push(makeTextRich("\n"));
      }
    }
    return mergeAdjacentRichText(richText);
  }

  function paragraphElementToBlocks(el) {
    const tokens = [];
    Array.from(el.childNodes).forEach((child) => collectInlineTokens(child, tokens));
    return tokensToParagraphBlocks(tokens);
  }

  function listElementToBlocks(el, ordered, depth = 0) {
    const blocks = [];
    Array.from(el.children).forEach((li) => {
      if (li.tagName.toLowerCase() !== "li") return;

      const richText = extractInlineRichText(li, true);
      if (hasRichTextContent(richText)) {
        const type = ordered ? "numbered_list_item" : "bulleted_list_item";
        blocks.push({
          type,
          __depth: depth,
          [type]: {
            rich_text: richText,
          },
        });
      }

      Array.from(li.children).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (tag === "ul") {
          blocks.push(...listElementToBlocks(child, false, depth + 1));
        } else if (tag === "ol") {
          blocks.push(...listElementToBlocks(child, true, depth + 1));
        }
      });
    });
    return blocks;
  }

  function tableToBlock(table) {
    const rows = [];
    let hasHeader = false;

    const thead = table.querySelector("thead");
    if (thead) {
      hasHeader = true;
      thead.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          const richText = extractInlineRichText(cell);
          cells.push(hasRichTextContent(richText) ? richText : [makeTextRich("")]);
        });
        if (cells.length) rows.push(cells);
      });
    }

    const tbody = table.querySelector("tbody");
    const bodyRows = tbody ? tbody.querySelectorAll("tr") : table.querySelectorAll("tr");
    bodyRows.forEach((tr) => {
      const cells = [];
      tr.querySelectorAll("td, th").forEach((cell) => {
        const richText = extractInlineRichText(cell);
        cells.push(hasRichTextContent(richText) ? richText : [makeTextRich("")]);
      });
      if (cells.length) rows.push(cells);
    });

    if (!rows.length) return [];

    const tableWidth = Math.max(...rows.map((row) => row.length));
    return [{
      type: "table",
      table: {
        table_width: tableWidth,
        has_column_header: hasHeader,
        has_row_header: false,
        children: rows.map((row) => ({
          type: "table_row",
          table_row: {
            cells: row,
          },
        })),
      },
    }];
  }

  function blockquoteToBlock(el, prefixRichText = []) {
    const body = extractInlineRichText(el);
    const richText = prefixRichText.concat(body);
    const merged = mergeAdjacentRichText(richText);
    if (!hasRichTextContent(merged)) return [];
    return [{
      type: "quote",
      quote: {
        rich_text: merged,
      },
    }];
  }

  function oneboxToBlocks(el) {
    const titleEl = el.querySelector("h3 a, header a, a[href]");
    const title = titleEl?.textContent?.trim() || "";
    const href = absoluteUrl(titleEl?.getAttribute("href") || "");
    const desc = el.querySelector("article p, p")?.textContent?.trim() || "";
    const content = desc ? `${title}\n${desc}` : title || href;
    if (!content) return [];
    return [{
      type: "paragraph",
      paragraph: {
        rich_text: [makeTextRich(content, {}, href || undefined)],
      },
    }];
  }

  function imageElementToBlock(img) {
    if (!img || isEmojiImage(img)) return [];
    const url = getBestImageUrl(img);
    if (!url) return [];
    const caption = sanitizeImageCaption(img.getAttribute("alt") || "");
    return [{
      type: "image",
      image: {
        type: "external",
        external: { url },
        caption: caption ? [makeTextRich(caption)] : [],
      },
    }];
  }

  function childrenToBlocks(el) {
    const blocks = [];
    Array.from(el.childNodes).forEach((child) => {
      blocks.push(...nodeToBlocks(child));
    });
    return blocks;
  }

  function nodeToBlocks(node) {
    if (!node) return [];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeTextNodeValue(node.nodeValue || "");
      if (!hasVisibleText(text)) return [];
      return [{
        type: "paragraph",
        paragraph: { rich_text: [makeTextRich(text)] },
      }];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const el = node;
    const tag = el.tagName.toLowerCase();

    if (el.classList?.contains("meta")) return [];

    if (el.classList?.contains("md-table")) {
      const table = el.querySelector("table");
      return table ? tableToBlock(table) : [];
    }

    if (
      el.classList?.contains("lightbox-wrapper") ||
      el.classList?.contains("image-wrapper") ||
      el.classList?.contains("lazyYT-container")
    ) {
      const img = el.querySelector("img");
      return img ? imageElementToBlock(img) : [];
    }

    if (el.classList?.contains("onebox")) {
      return oneboxToBlocks(el);
    }

    if (tag === "aside" && el.classList?.contains("quote")) {
      const titleLink = el.querySelector(".quote-title__text-content a, .title > a, .quote-title a");
      const title = titleLink?.textContent?.trim() || "引用";
      const href = absoluteUrl(titleLink?.getAttribute("href") || "");
      const prefix = [makeTextRich("引用: ")];
      prefix.push(makeTextRich(title, {}, href || undefined));
      prefix.push(makeTextRich("\n"));
      const quoteBody = el.querySelector("blockquote") || el;
      return blockquoteToBlock(quoteBody, prefix);
    }

    if (tag === "p") return paragraphElementToBlocks(el);

    if (tag === "pre") {
      const codeEl = el.querySelector("code");
      const className = codeEl?.getAttribute("class") || "";
      const rawLang = (className.match(/lang(?:uage)?-([a-z0-9_+-]+)/i) || [])[1] || "plain text";
      const language = normalizeLanguage(rawLang);
      const code = (codeEl ? codeEl.textContent : el.textContent) || "";
      return [{
        type: "code",
        code: {
          language,
          rich_text: [makeTextRich(code)],
        },
      }];
    }

    if (tag === "blockquote") {
      return blockquoteToBlock(el);
    }

    if (/^h[1-3]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const richText = extractInlineRichText(el);
      if (!hasRichTextContent(richText)) return [];
      return [{
        type: `heading_${level}`,
        [`heading_${level}`]: {
          rich_text: richText,
        },
      }];
    }

    if (tag === "ul") return listElementToBlocks(el, false);
    if (tag === "ol") return listElementToBlocks(el, true);
    if (tag === "table") return tableToBlock(el);
    if (tag === "img") return imageElementToBlock(el);
    if (tag === "hr") return [{ type: "divider", divider: {} }];

    if (tag === "details") {
      const blocks = [];
      const summary = el.querySelector(":scope > summary");
      if (summary) {
        const richText = extractInlineRichText(summary);
        if (hasRichTextContent(richText)) {
          blocks.push({
            type: "paragraph",
            paragraph: {
              rich_text: [makeTextRich("折叠内容: ")].concat(richText),
            },
          });
        }
      }
      Array.from(el.children).forEach((child) => {
        if (child.tagName.toLowerCase() !== "summary") {
          blocks.push(...nodeToBlocks(child));
        }
      });
      return blocks;
    }

    return childrenToBlocks(el);
  }

  function cleanBlockList(blocks) {
    const cleaned = [];
    for (const block of blocks) {
      if (!block) continue;
      const prev = cleaned[cleaned.length - 1];
      if (block.type === "paragraph") {
        const richText = block.paragraph?.rich_text || [];
        if (!hasRichTextContent(richText)) continue;
      }
      if (block.type === "divider" && prev?.type === "divider") continue;
      cleaned.push(block);
    }
    while (cleaned[0]?.type === "divider") cleaned.shift();
    while (cleaned[cleaned.length - 1]?.type === "divider") cleaned.pop();
    return cleaned;
  }

  function cookedToPortableBlocks(cookedHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cookedHtml || "", "text/html");
    const root = doc.body;
    const blocks = [];
    Array.from(root.childNodes).forEach((child) => {
      blocks.push(...nodeToBlocks(child));
    });
    return cleanBlockList(blocks);
  }

  function buildPostTitle(post, topic) {
    const isOp = (post.username || "").toLowerCase() === (topic.opUsername || "").toLowerCase();
    let author = post.name || post.username || "匿名用户";
    if (post.name && post.username && post.name !== post.username) {
      author += `（@${post.username}）`;
    } else if (post.username && author === post.username) {
      author = `@${post.username}`;
    }
    let title = `第 ${post.post_number} 楼｜${author}`;
    if (isOp) title += "｜楼主";
    const date = formatDate(post.created_at);
    if (date) title += `｜${date}`;
    return title;
  }

  function buildPostBlocks(post, topic) {
    const blocks = [{
      type: "heading_2",
      heading_2: {
        rich_text: [makeTextRich(buildPostTitle(post, topic))],
      },
    }];

    if (post.reply_to_post_number) {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [makeTextRich(`回复楼层：第 ${post.reply_to_post_number} 楼`, { italic: true })],
        },
      });
    }

    blocks.push(...cookedToPortableBlocks(post.cooked || ""));
    return cleanBlockList(blocks);
  }

  function buildMetadataBlocks(topic, selection) {
    const exportTime = formatDate(new Date());
    const tags = topic.tags?.length ? topic.tags.join(", ") : "无";
    const lines = [
      { text: `主题编号：${topic.topicId}` },
      { text: `作者：@${topic.opUsername || "未知"}` },
      { text: `分类：${topic.category || "无"}` },
      { text: `标签：${tags}` },
      { text: `筛选条件：${selection.scopeLabel}` },
      { text: `导出楼层数量：${selection.posts.length}` },
      { text: `导出时间：${exportTime}` },
    ];

    const blocks = [];
    blocks.push({
      type: "paragraph",
      paragraph: {
        rich_text: [
          makeTextRich("原文链接："),
          makeTextRich(topic.url, {}, topic.url),
        ],
      },
    });
    lines.forEach((line) => {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [makeTextRich(line.text)],
        },
      });
    });
    blocks.push({ type: "divider", divider: {} });
    return blocks;
  }

  function buildDocumentBlocks(topic, selection) {
    const blocks = buildMetadataBlocks(topic, selection);
    selection.posts.forEach((post, index) => {
      blocks.push(...buildPostBlocks(post, topic));
      if (index < selection.posts.length - 1) {
        blocks.push({ type: "divider", divider: {} });
      }
    });
    return cleanBlockList(blocks);
  }

  function escapeMarkdownText(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/([*_{}\[\]()#+.!<>~-])/g, "\\$1");
  }

  function escapeMarkdownTableText(text) {
    return escapeMarkdownText(text).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  }

  function wrapInlineCode(text) {
    const raw = String(text || "");
    const matches = raw.match(/`+/g) || [];
    const longest = matches.reduce((max, part) => Math.max(max, part.length), 0);
    const fence = "`".repeat(longest + 1);
    return `${fence}${raw}${fence}`;
  }

  function renderRichTextToMarkdown(richText) {
    return (richText || [])
      .map((item) => {
        const raw = item?.text?.content || "";
        if (!raw) return "";

        let text = item.annotations?.code ? wrapInlineCode(raw) : escapeMarkdownText(raw);
        text = text.replace(/\n/g, "<br>");

        if (!item.annotations?.code) {
          if (item.annotations?.bold) text = `**${text}**`;
          if (item.annotations?.italic) text = `*${text}*`;
          if (item.annotations?.strikethrough) text = `~~${text}~~`;
        }

        const link = item?.text?.link?.url;
        if (link) {
          text = `[${text}](${link})`;
        }

        return text;
      })
      .join("")
      .trim();
  }

  function renderRichTextToPlain(richText) {
    return (richText || []).map((item) => item?.text?.content || "").join("").trim();
  }

  function renderQuoteMarkdown(richText) {
    const text = renderRichTextToMarkdown(richText);
    if (!text) return "";
    return text
      .split(/<br>/g)
      .map((line) => `> ${line}`)
      .join("\n");
  }

  function renderListItemMarkdown(prefix, text, depth) {
    const indent = "  ".repeat(depth || 0);
    if (!text) return `${indent}${prefix}`;
    const lines = text.split(/<br>/g);
    const first = `${indent}${prefix} ${lines[0]}`;
    const rest = lines.slice(1).map((line) => `${indent}  ${line}`);
    return [first].concat(rest).join("\n");
  }

  function renderTableMarkdown(block) {
    const rows = block?.table?.children || [];
    if (!rows.length) return "";

    const renderedRows = rows.map((row) =>
      (row?.table_row?.cells || []).map((cell) => escapeMarkdownTableText(renderRichTextToMarkdown(cell)))
    );

    const width = Math.max(...renderedRows.map((row) => row.length));
    renderedRows.forEach((row) => {
      while (row.length < width) row.push("");
    });

    const header = renderedRows[0];
    const divider = new Array(width).fill("---");
    const body = renderedRows.slice(1);

    const lines = [];
    lines.push(`| ${header.join(" | ")} |`);
    lines.push(`| ${divider.join(" | ")} |`);
    body.forEach((row) => lines.push(`| ${row.join(" | ")} |`));
    return lines.join("\n");
  }

  function renderBlockMarkdown(block) {
    if (!block) return "";

    if (block.type === "paragraph") {
      return renderRichTextToMarkdown(block.paragraph?.rich_text || []);
    }

    if (block.type === "heading_1") {
      return `# ${renderRichTextToMarkdown(block.heading_1?.rich_text || [])}`;
    }
    if (block.type === "heading_2") {
      return `## ${renderRichTextToMarkdown(block.heading_2?.rich_text || [])}`;
    }
    if (block.type === "heading_3") {
      return `### ${renderRichTextToMarkdown(block.heading_3?.rich_text || [])}`;
    }

    if (block.type === "quote") {
      return renderQuoteMarkdown(block.quote?.rich_text || []);
    }

    if (block.type === "bulleted_list_item") {
      return renderListItemMarkdown("-", renderRichTextToMarkdown(block.bulleted_list_item?.rich_text || []), block.__depth || 0);
    }

    if (block.type === "numbered_list_item") {
      return renderListItemMarkdown("1.", renderRichTextToMarkdown(block.numbered_list_item?.rich_text || []), block.__depth || 0);
    }

    if (block.type === "code") {
      const lang = block.code?.language && block.code.language !== "plain text" ? block.code.language : "";
      const content = renderRichTextToPlain(block.code?.rich_text || []);
      return `\`\`\`${lang}\n${content}\n\`\`\``;
    }

    if (block.type === "divider") {
      return "---";
    }

    if (block.type === "image") {
      const url = block.image?.external?.url || "";
      if (!url) return "";
      const caption = sanitizeImageCaption(renderRichTextToPlain(block.image?.caption || []));
      return caption
        ? `![${escapeMarkdownText(caption)}](${url})`
        : `![](${url})`;
    }

    if (block.type === "table") {
      return renderTableMarkdown(block);
    }

    return "";
  }

  function blocksToMarkdown(blocks) {
    const parts = [];
    let prevWasList = false;

    for (const block of blocks) {
      const text = renderBlockMarkdown(block);
      if (!text) continue;

      const isList =
        block.type === "bulleted_list_item" ||
        block.type === "numbered_list_item";

      if (parts.length === 0) {
        parts.push(text);
      } else if (isList && prevWasList) {
        parts.push(text);
      } else {
        parts.push("", text);
      }

      prevWasList = isList;
    }

    return parts.join("\n").trim() + "\n";
  }

  function buildMarkdownDocument(topic, selection, blocks) {
    const title = `${topic.title}${selection.suffix || ""}`;
    return [
      `# ${title}`,
      "",
      blocksToMarkdown(blocks),
    ].join("\n");
  }

  function splitTextContent(content, maxLen = NOTION_RICH_TEXT_LIMIT) {
    const chunks = [];
    let rest = String(content || "");

    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf("\n", maxLen);
      if (cut < maxLen * 0.5) cut = rest.lastIndexOf(" ", maxLen);
      if (cut < maxLen * 0.5) cut = maxLen;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }

    if (rest) chunks.push(rest);
    return chunks.length ? chunks : [""];
  }

  function splitRichTextArrayForNotion(richText) {
    const result = [];
    (richText || []).forEach((item) => {
      const content = item?.text?.content || "";
      if (content.length <= NOTION_RICH_TEXT_LIMIT) {
        result.push(item);
        return;
      }
      const chunks = splitTextContent(content);
      chunks.forEach((chunk) => {
        result.push({
          ...deepClone(item),
          text: {
            ...deepClone(item.text),
            content: chunk,
          },
        });
      });
    });
    return result;
  }

  function sanitizeBlockForNotion(block) {
    if (!block) return null;
    const cloned = deepClone(block);
    delete cloned.__depth;

    if (cloned.paragraph?.rich_text) {
      cloned.paragraph.rich_text = splitRichTextArrayForNotion(cloned.paragraph.rich_text);
    }
    if (cloned.heading_1?.rich_text) {
      cloned.heading_1.rich_text = splitRichTextArrayForNotion(cloned.heading_1.rich_text);
    }
    if (cloned.heading_2?.rich_text) {
      cloned.heading_2.rich_text = splitRichTextArrayForNotion(cloned.heading_2.rich_text);
    }
    if (cloned.heading_3?.rich_text) {
      cloned.heading_3.rich_text = splitRichTextArrayForNotion(cloned.heading_3.rich_text);
    }
    if (cloned.quote?.rich_text) {
      cloned.quote.rich_text = splitRichTextArrayForNotion(cloned.quote.rich_text);
    }
    if (cloned.code?.rich_text) {
      cloned.code.rich_text = splitRichTextArrayForNotion(cloned.code.rich_text);
    }
    if (cloned.bulleted_list_item?.rich_text) {
      cloned.bulleted_list_item.rich_text = splitRichTextArrayForNotion(cloned.bulleted_list_item.rich_text);
    }
    if (cloned.numbered_list_item?.rich_text) {
      cloned.numbered_list_item.rich_text = splitRichTextArrayForNotion(cloned.numbered_list_item.rich_text);
    }
    if (cloned.image?.caption) {
      cloned.image.caption = splitRichTextArrayForNotion(cloned.image.caption);
    }
    if (cloned.table?.children) {
      cloned.table.children = cloned.table.children.map((row) => ({
        ...row,
        table_row: {
          ...row.table_row,
          cells: (row.table_row?.cells || []).map((cell) => splitRichTextArrayForNotion(cell)),
        },
      }));
    }
    return cloned;
  }

  function sanitizeBlocksForNotion(blocks) {
    return blocks.map(sanitizeBlockForNotion).filter(Boolean);
  }

  function notionRequest(method, url, apiKey, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        data: JSON.stringify(data),
        onload: (response) => {
          try {
            const body = response.responseText ? JSON.parse(response.responseText) : {};
            if (response.status >= 200 && response.status < 300) {
              resolve(body);
            } else {
              reject(new Error(`Notion API ${response.status}: ${body?.message || response.statusText || "请求失败"}`));
            }
          } catch (err) {
            reject(err);
          }
        },
        onerror: (error) => {
          reject(new Error(`Notion 请求失败: ${error}`));
        },
      });
    });
  }

  async function appendBlocksToPage(pageId, blocks, apiKey, onProgress) {
    const chunks = [];
    for (let i = 0; i < blocks.length; i += 100) {
      chunks.push(blocks.slice(i, i + 100));
    }

    for (let i = 0; i < chunks.length; i++) {
      await notionRequest("PATCH", `https://api.notion.com/v1/blocks/${pageId}/children`, apiKey, {
        children: chunks[i],
      });
      if (typeof onProgress === "function") {
        onProgress(i + 1, chunks.length, "追加 Notion 内容");
      }
      await sleep(250);
    }
  }

  async function createNotionPage(title, blocks, apiKey, parentPageId, onProgress) {
    const initialBlocks = blocks.slice(0, 100);
    const remainingBlocks = blocks.slice(100);

    const pageData = await notionRequest("POST", "https://api.notion.com/v1/pages", apiKey, {
      parent: {
        type: "page_id",
        page_id: parentPageId,
      },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
      },
      children: initialBlocks,
    });

    if (remainingBlocks.length) {
      await appendBlocksToPage(pageData.id, remainingBlocks, apiKey, onProgress);
    }

    return pageData;
  }

  function findButtonContainer(topicMap) {
    for (const sel of [".topic-map__buttons", ".topic-footer-main-controls", ".buttons"]) {
      const el = topicMap.querySelector(sel);
      if (el) return el;
    }
    const summarizeBtn = topicMap.querySelector(
      ".summarize-topic, button.create-summary, button.topic-map__summarize-btn, button"
    );
    if (summarizeBtn) return summarizeBtn.parentElement;
    const children = [...topicMap.children].filter((el) => el.tagName === "DIV" || el.tagName === "SECTION");
    return children.length ? children[children.length - 1] : null;
  }

  function createButton() {
    const btn = document.createElement("button");
    btn.className = "ld-hybrid-btn";
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      导出 Markdown/Notion
    `;
    return btn;
  }

  function injectButton(topicMap) {
    if (topicMap.querySelector(".ld-hybrid-btn")) return false;
    const container = findButtonContainer(topicMap);
    if (!container) return false;
    const btn = createButton();
    container.insertBefore(btn, container.firstChild);
    return true;
  }

  function ensureFloatingButton() {
    const floatingBtn = document.querySelector(".ld-hybrid-floating-btn");
    const hasInlineButton = Array.from(document.querySelectorAll(".ld-hybrid-btn")).some(
      (btn) => !btn.classList.contains("ld-hybrid-floating-btn")
    );

    if (hasInlineButton) {
      floatingBtn?.remove();
      return;
    }

    if (floatingBtn) return;

    const btn = createButton();
    btn.classList.add("ld-hybrid-floating-btn");
    btn.title = "导出 Markdown/Notion";
    document.body.appendChild(btn);
  }

  function createModal() {
    const overlay = document.createElement("div");
    overlay.className = "ld-hybrid-overlay";

    const box = document.createElement("div");
    box.className = "ld-hybrid-modal";
    box.innerHTML = `
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        导出 Markdown/Notion
      </h3>

      <div class="ld-hybrid-group">
        <label for="ld-hybrid-target">导出目标</label>
        <select id="ld-hybrid-target" class="ld-hybrid-control">
          <option value="markdown">Markdown 文件（适合导入 Notion）</option>
          <option value="notion">直接导出到 Notion 页面</option>
        </select>
        <div class="ld-hybrid-hint">Markdown 适合归档与再次编辑；直接导出到 Notion 时，将采用更适合阅读的文档结构。</div>
      </div>

      <div class="ld-hybrid-group">
        <label for="ld-hybrid-floor-mode">楼层范围</label>
        <select id="ld-hybrid-floor-mode" class="ld-hybrid-control">
          <option value="all">全部楼层</option>
          <option value="range">指定楼层范围</option>
        </select>
      </div>

      <div id="ld-hybrid-floor-range-wrap" class="ld-hybrid-group ld-hybrid-hidden">
        <label>起止楼层</label>
        <div class="ld-hybrid-range-fields">
          <input id="ld-hybrid-range-start" class="ld-hybrid-input" type="number" min="1" value="1" />
          <span>至</span>
          <input id="ld-hybrid-range-end" class="ld-hybrid-input" type="number" min="1" value="999999" />
        </div>
        <div class="ld-hybrid-hint">仅当“楼层范围”设为“指定楼层范围”时生效。</div>
      </div>

      <div class="ld-hybrid-group">
        <label class="ld-hybrid-checkline">
          <input id="ld-hybrid-only-first" type="checkbox" />
          <span>仅导出主题首楼（第 1 楼）</span>
        </label>
        <label class="ld-hybrid-checkline" style="margin-bottom:0;">
          <input id="ld-hybrid-only-op" type="checkbox" />
          <span>仅导出楼主发言</span>
        </label>
      </div>

      <div id="ld-hybrid-notion-wrap" class="ld-hybrid-section ld-hybrid-hidden">
        <div class="ld-hybrid-config-head">
          <span class="ld-hybrid-config-title">Notion 连接配置</span>
          <button id="ld-hybrid-toggle-notion" class="ld-hybrid-btn2 ld-hybrid-btn-secondary" type="button">展开配置</button>
        </div>
        <div id="ld-hybrid-notion-config-body" class="ld-hybrid-config-body">
          <div class="ld-hybrid-group">
            <label for="ld-hybrid-notion-api-key">Notion API Key</label>
            <input id="ld-hybrid-notion-api-key" class="ld-hybrid-input" type="password" placeholder="secret_xxx" />
          </div>
          <div class="ld-hybrid-group" style="margin-bottom:0;">
            <label for="ld-hybrid-notion-page-id">父页面 ID</label>
            <input id="ld-hybrid-notion-page-id" class="ld-hybrid-input" type="text" placeholder="32 位 page id" />
            <div class="ld-hybrid-hint">在 Notion integration 里共享目标页面给你的 integration，再填这里的父页面 ID。</div>
          </div>
          <div class="ld-hybrid-inline-actions">
            <span id="ld-hybrid-notion-saved" class="ld-hybrid-saved"></span>
            <button id="ld-hybrid-clear-notion" class="ld-hybrid-btn2 ld-hybrid-btn-secondary" type="button">清空已保存配置</button>
          </div>
        </div>
      </div>

      <div id="ld-hybrid-status" class="ld-hybrid-status"></div>

      <div class="ld-hybrid-actions">
        <button id="ld-hybrid-cancel" class="ld-hybrid-btn2 ld-hybrid-btn-cancel">取消</button>
        <button id="ld-hybrid-export" class="ld-hybrid-btn2 ld-hybrid-btn-primary">导出</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const targetSel = box.querySelector("#ld-hybrid-target");
    const floorModeSel = box.querySelector("#ld-hybrid-floor-mode");
    const floorRangeWrap = box.querySelector("#ld-hybrid-floor-range-wrap");
    const rangeStartInput = box.querySelector("#ld-hybrid-range-start");
    const rangeEndInput = box.querySelector("#ld-hybrid-range-end");
    const onlyFirstInput = box.querySelector("#ld-hybrid-only-first");
    const onlyOpInput = box.querySelector("#ld-hybrid-only-op");
    const notionWrap = box.querySelector("#ld-hybrid-notion-wrap");
    const notionToggleBtn = box.querySelector("#ld-hybrid-toggle-notion");
    const notionConfigBody = box.querySelector("#ld-hybrid-notion-config-body");
    const notionApiKeyInput = box.querySelector("#ld-hybrid-notion-api-key");
    const notionPageIdInput = box.querySelector("#ld-hybrid-notion-page-id");
    const notionSavedEl = box.querySelector("#ld-hybrid-notion-saved");
    const clearNotionBtn = box.querySelector("#ld-hybrid-clear-notion");
    const statusEl = box.querySelector("#ld-hybrid-status");
    const exportBtn = box.querySelector("#ld-hybrid-export");
    const cancelBtn = box.querySelector("#ld-hybrid-cancel");

    targetSel.value = GM_getValue(STORE.TARGET, DEFAULTS.target);
    floorModeSel.value = GM_getValue(STORE.FLOOR_MODE, DEFAULTS.floorMode);
    rangeStartInput.value = String(GM_getValue(STORE.RANGE_START, DEFAULTS.rangeStart));
    rangeEndInput.value = String(GM_getValue(STORE.RANGE_END, DEFAULTS.rangeEnd));
    onlyFirstInput.checked = !!GM_getValue(STORE.ONLY_FIRST, DEFAULTS.onlyFirst);
    onlyOpInput.checked = !!GM_getValue(STORE.ONLY_OP, DEFAULTS.onlyOp);
    notionApiKeyInput.value = GM_getValue(STORE.NOTION_API_KEY, DEFAULTS.notionApiKey);
    notionPageIdInput.value = GM_getValue(STORE.NOTION_PAGE_ID, DEFAULTS.notionPageId);
    let notionConfigOpen = false;

    function hasValidPageId(value) {
      return /^[a-f0-9]{32}$/i.test(String(value || "").trim().replace(/-/g, ""));
    }

    function hasCurrentNotionConfig() {
      return Boolean(notionApiKeyInput.value.trim()) && hasValidPageId(notionPageIdInput.value);
    }

    function setNotionConfigExpanded(open) {
      notionConfigOpen = open;
      notionConfigBody.classList.toggle("ld-hybrid-hidden", !open);
      notionToggleBtn.textContent = open ? "收起配置" : "展开配置";
    }

    function updateSavedHint() {
      const hasSaved =
        Boolean(GM_getValue(STORE.NOTION_CONFIG_SAVED, false)) &&
        Boolean(notionApiKeyInput.value.trim()) &&
        hasValidPageId(notionPageIdInput.value);
      notionSavedEl.textContent = hasSaved ? "已保存，下次会自动带出" : "";
    }

    function persistNotionConfig() {
      const apiKey = notionApiKeyInput.value.trim();
      const pageId = notionPageIdInput.value.trim().replace(/-/g, "");
      GM_setValue(STORE.NOTION_API_KEY, apiKey);
      GM_setValue(STORE.NOTION_PAGE_ID, pageId);
      GM_setValue(
        STORE.NOTION_CONFIG_SAVED,
        Boolean(apiKey) && hasValidPageId(pageId)
      );
      updateSavedHint();
    }

    function syncFloorControls() {
      const onlyFirst = !!onlyFirstInput.checked;
      const rangeMode = floorModeSel.value === "range" ? "range" : "all";
      const rangeDisabled = onlyFirst || rangeMode !== "range";
      floorModeSel.disabled = onlyFirst;
      floorModeSel.style.opacity = onlyFirst ? "0.55" : "1";
      floorRangeWrap.classList.toggle("ld-hybrid-hidden", rangeMode !== "range");
      rangeStartInput.disabled = rangeDisabled;
      rangeEndInput.disabled = rangeDisabled;
      rangeStartInput.style.opacity = rangeDisabled ? "0.55" : "1";
      rangeEndInput.style.opacity = rangeDisabled ? "0.55" : "1";
    }

    function syncVisibility() {
      notionWrap.classList.toggle("ld-hybrid-hidden", targetSel.value !== "notion");
      if (targetSel.value === "notion" && !hasCurrentNotionConfig()) {
        setNotionConfigExpanded(true);
      }
      syncFloorControls();
    }

    function closeModal() {
      overlay.style.opacity = "0";
      box.style.transform = "translateY(10px) scale(0.98)";
      setTimeout(() => overlay.remove(), 180);
    }

    function setStatus(text, color = "var(--primary-medium, #919191)") {
      statusEl.style.color = color;
      statusEl.textContent = text;
    }

    targetSel.addEventListener("change", syncVisibility);
    floorModeSel.addEventListener("change", syncVisibility);
    onlyFirstInput.addEventListener("change", syncVisibility);
    notionToggleBtn.addEventListener("click", () => {
      setNotionConfigExpanded(!notionConfigOpen);
    });
    notionApiKeyInput.addEventListener("input", persistNotionConfig);
    notionPageIdInput.addEventListener("input", persistNotionConfig);
    clearNotionBtn.addEventListener("click", () => {
      notionApiKeyInput.value = "";
      notionPageIdInput.value = "";
      GM_setValue(STORE.NOTION_API_KEY, "");
      GM_setValue(STORE.NOTION_PAGE_ID, "");
      GM_setValue(STORE.NOTION_CONFIG_SAVED, false);
      updateSavedHint();
      setNotionConfigExpanded(true);
      setStatus("已清空保存的 Notion 配置");
    });
    setNotionConfigExpanded(!hasCurrentNotionConfig());
    updateSavedHint();
    syncVisibility();

    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });

    exportBtn.addEventListener("click", async () => {
      const topicId = getTopicId();
      if (!topicId) {
        setStatus("❌ 无法解析 Topic ID", "var(--danger, #e45735)");
        return;
      }

      const target = targetSel.value;
      const floorMode = floorModeSel.value === "range" ? "range" : "all";
      const rangeStart = clampInt(rangeStartInput.value, 1, 999999, DEFAULTS.rangeStart);
      const rangeEnd = clampInt(rangeEndInput.value, 1, 999999, DEFAULTS.rangeEnd);
      const onlyFirst = !!onlyFirstInput.checked;
      const onlyOp = !!onlyOpInput.checked;
      const notionApiKey = notionApiKeyInput.value.trim();
      const notionPageId = notionPageIdInput.value.trim().replace(/-/g, "");

      GM_setValue(STORE.TARGET, target);
      GM_setValue(STORE.FLOOR_MODE, floorMode);
      GM_setValue(STORE.RANGE_START, rangeStart);
      GM_setValue(STORE.RANGE_END, rangeEnd);
      GM_setValue(STORE.ONLY_FIRST, onlyFirst);
      GM_setValue(STORE.ONLY_OP, onlyOp);
      persistNotionConfig();

      if (target === "notion" && !notionApiKey) {
        setStatus("❌ 请先填写 Notion API Key", "var(--danger, #e45735)");
        setNotionConfigExpanded(true);
        return;
      }
      if (target === "notion" && !hasValidPageId(notionPageId)) {
        setStatus("❌ 请填写有效的 32 位 Notion 父页面 ID", "var(--danger, #e45735)");
        setNotionConfigExpanded(true);
        return;
      }

      exportBtn.disabled = true;
      exportBtn.textContent = "导出中…";

      try {
        setStatus("⏳ 正在拉取帖子…");
        const data = await fetchAllPostsDetailed(topicId, (done, total, phase) => {
          setStatus(`⏳ ${phase} (${done}/${total})`);
        });

        const selection = selectPosts(data, {
          floorMode,
          rangeStart,
          rangeEnd,
          onlyFirst,
          onlyOp,
        });
        if (!selection.posts.length) {
          setStatus("⚠️ 当前筛选条件下未匹配到任何楼层。", "var(--danger, #e9a100)");
          return;
        }

        setStatus(`⏳ 正在整理内容结构（${selection.posts.length} 楼）…`);
        const title = `${data.topic.title}${selection.suffix || ""}`;
        const blocks = buildDocumentBlocks(data.topic, selection);

        if (target === "markdown") {
          const markdown = buildMarkdownDocument(data.topic, selection, blocks);
          const filename = `${safeFilename(title)}.md`;
          downloadText(filename, markdown);
          setStatus(`✅ 已下载：${filename}`, "var(--success, #009900)");
          setTimeout(closeModal, 1200);
          return;
        }

        setStatus("⏳ 正在导出到 Notion…");
        const notionBlocks = sanitizeBlocksForNotion(blocks);
        const page = await createNotionPage(title, notionBlocks, notionApiKey, notionPageId, (done, total, phase) => {
          setStatus(`⏳ ${phase} (${done}/${total})`);
        });
        setStatus("✅ 已导出到 Notion", "var(--success, #009900)");
        setTimeout(() => {
          if (page?.url && confirm("导出完成，是否打开 Notion 页面？")) {
            window.open(page.url, "_blank", "noopener");
          }
          closeModal();
        }, 300);
      } catch (err) {
        setStatus(`❌ ${err.message || err}`, "var(--danger, #e45735)");
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = "导出";
      }
    });
  }

  injectStyles();

  const injectedMaps = new WeakSet();

  document.body.addEventListener("click", (event) => {
    if (event.target.closest(".ld-hybrid-btn")) {
      event.preventDefault();
      event.stopPropagation();
      createModal();
    }
  });

  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !injectedMaps.has(entry.target)) {
        if (injectButton(entry.target)) {
          injectedMaps.add(entry.target);
          intersectionObserver.unobserve(entry.target);
        }
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "50px",
  });

  let mutationTimer = null;
  let currentContentArea = document.querySelector("#main-outlet, #topic, .container.posts") || document.body;
  const mutationObserver = new MutationObserver(() => {
    if (mutationTimer) return;
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      currentContentArea.querySelectorAll(".topic-map").forEach((map) => {
        if (!injectedMaps.has(map)) {
          intersectionObserver.observe(map);
        }
      });
      ensureFloatingButton();
    }, 700);
  });

  mutationObserver.observe(currentContentArea, {
    childList: true,
    subtree: true,
  });

  document.querySelectorAll(".topic-map").forEach((map) => {
    intersectionObserver.observe(map);
  });
  ensureFloatingButton();

  function cleanup() {
    intersectionObserver.disconnect();
    mutationObserver.disconnect();
  }

  function reinit() {
    cleanup();
    currentContentArea = document.querySelector("#main-outlet, #topic, .container.posts") || document.body;
    mutationObserver.observe(currentContentArea, { childList: true, subtree: true });
    document.querySelectorAll(".topic-map").forEach((map) => {
      if (!injectedMaps.has(map)) {
        intersectionObserver.observe(map);
      }
    });
    ensureFloatingButton();
  }

  window.addEventListener("popstate", reinit);

  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    setTimeout(reinit, 100);
  };
})();
