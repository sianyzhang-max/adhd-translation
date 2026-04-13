(function () {
  const STORAGE_KEY = "translation_review_records_v1";
  const HOME_PREVIEW_COUNT = 4;

  const state = {
    articleIndex: 0,
    paragraphIndex: 0,
    referenceExpanded: false
  };

  const ruleCheatSheet = [
    { name: "长句拆分", when: "原句信息层级多、从句长", tip: "先切主干，再补修饰，层次会更清楚。" },
    { name: "词性转换", when: "英文名词链过长、中文生硬", tip: "名词转动词/形容词，读起来更顺。" },
    { name: "顺译与倒译", when: "按原序不自然", tip: "先保证逻辑，再决定顺着译还是倒着译。" },
    { name: "增译", when: "中文需要补出隐含关系", tip: "补逻辑词，不补无关信息。" },
    { name: "省译", when: "重复信息影响中文节奏", tip: "不影响核心信息时可适度压缩。" },
    { name: "主被动转换", when: "原句被动结构过多", tip: "中文优先自然表达，不必拘泥形式。" },
    { name: "抽象表达落地", when: "英文抽象名词密集", tip: "把抽象词还原成可感知动作或状态。" },
    { name: "术语统一", when: "同一概念在文中反复出现", tip: "先定译法，再全段保持一致。" }
  ];

  const dom = {
    homeArticleSection: document.getElementById("homeArticleSection"),
    allArticlesSection: document.getElementById("allArticlesSection"),
    articleCount: document.getElementById("articleCount"),
    articleList: document.getElementById("articleList"),
    allArticleList: document.getElementById("allArticleList"),
    viewAllArticlesBtn: document.getElementById("viewAllArticlesBtn"),
    backHomeBtn: document.getElementById("backHomeBtn"),
    currentArticleMeta: document.getElementById("currentArticleMeta"),
    articleReader: document.getElementById("articleReader"),
    currentParagraphMeta: document.getElementById("currentParagraphMeta"),
    practiceSource: document.getElementById("practiceSource"),
    techniqueHint: document.getElementById("techniqueHint"),
    myTranslation: document.getElementById("myTranslation"),
    toggleReferenceBtn: document.getElementById("toggleReferenceBtn"),
    referencePanel: document.getElementById("referencePanel"),
    referenceText: document.getElementById("referenceText"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    analysisSummary: document.getElementById("analysisSummary"),
    issueTags: document.getElementById("issueTags"),
    myDiffView: document.getElementById("myDiffView"),
    refDiffView: document.getElementById("refDiffView"),
    suggestions: document.getElementById("suggestions"),
    reviewProblem: document.getElementById("reviewProblem"),
    reviewLearned: document.getElementById("reviewLearned"),
    reviewPattern: document.getElementById("reviewPattern"),
    reviewReminder: document.getElementById("reviewReminder"),
    saveReviewBtn: document.getElementById("saveReviewBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonBtn: document.getElementById("importJsonBtn"),
    exportWordBtn: document.getElementById("exportWordBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    importJsonInput: document.getElementById("importJsonInput"),
    saveHint: document.getElementById("saveHint"),
    ruleToggleBtn: document.getElementById("ruleToggleBtn"),
    closeRuleBtn: document.getElementById("closeRuleBtn"),
    rulePanel: document.getElementById("rulePanel"),
    ruleCards: document.getElementById("ruleCards")
  };

  function getCurrentArticle() {
    return window.ARTICLES[state.articleIndex];
  }

  function getCurrentReference() {
    const article = getCurrentArticle();
    return article.referenceTranslations[state.paragraphIndex] || "";
  }

  function getRecordKey() {
    const article = getCurrentArticle();
    return article.id + "__" + state.paragraphIndex;
  }

  function safeParse(jsonText, fallback) {
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      return fallback;
    }
  }

  function readAllRecords() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw, {}) : {};
  }

  function writeAllRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function showSaveHint(message) {
    dom.saveHint.textContent = message;
    setTimeout(function () {
      if (dom.saveHint.textContent === message) {
        dom.saveHint.textContent = "";
      }
    }, 2800);
  }

  function escapeHtml(text) {
    const value = String(text || "");
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateToken() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    return yyyy + mm + dd + "_" + hh + mi;
  }

  function downloadBlob(fileName, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 300);
  }

  function parseRecordKey(key) {
    const splitAt = key.lastIndexOf("__");
    if (splitAt <= 0) {
      return null;
    }
    const articleId = key.slice(0, splitAt);
    const paragraphIndex = Number(key.slice(splitAt + 2));
    if (!articleId || Number.isNaN(paragraphIndex)) {
      return null;
    }
    return { articleId, paragraphIndex };
  }

  function isRecordFilled(record) {
    if (!record) {
      return false;
    }
    return Boolean(
      (record.userTranslation && record.userTranslation.trim()) ||
      (record.problem && record.problem.trim()) ||
      (record.learned && record.learned.trim()) ||
      (record.pattern && record.pattern.trim()) ||
      (record.reminder && record.reminder.trim())
    );
  }

  function getReviewExportItems() {
    const records = readAllRecords();
    const articleMap = {};
    window.ARTICLES.forEach(function (article) {
      articleMap[article.id] = article;
    });

    const items = Object.keys(records)
      .map(function (key) {
        const parsed = parseRecordKey(key);
        if (!parsed) {
          return null;
        }
        const article = articleMap[parsed.articleId];
        if (!article) {
          return null;
        }
        const paragraphIndex = parsed.paragraphIndex;
        const record = records[key] || {};
        if (!isRecordFilled(record)) {
          return null;
        }
        return {
          articleId: article.id,
          articleTitle: article.titleZh,
          articleTitleEn: article.title,
          paragraphIndex: paragraphIndex,
          paragraphNo: paragraphIndex + 1,
          paragraphEn: article.paragraphs[paragraphIndex] || "",
          referenceTranslation: article.referenceTranslations[paragraphIndex] || "",
          userTranslation: record.userTranslation || "",
          problem: record.problem || "",
          learned: record.learned || "",
          pattern: record.pattern || "",
          reminder: record.reminder || "",
          savedAt: record.savedAt || ""
        };
      })
      .filter(Boolean);

    items.sort(function (a, b) {
      if (a.articleTitle === b.articleTitle) {
        return a.paragraphIndex - b.paragraphIndex;
      }
      return a.articleTitle.localeCompare(b.articleTitle, "zh-Hans-CN");
    });

    return items;
  }

  function buildExportDocumentHtml(items, options) {
    const title = options.title;
    const subtitle = options.subtitle;
    const currentDate = new Date().toLocaleString();
    const grouped = {};

    items.forEach(function (item) {
      if (!grouped[item.articleId]) {
        grouped[item.articleId] = {
          title: item.articleTitle,
          titleEn: item.articleTitleEn,
          rows: []
        };
      }
      grouped[item.articleId].rows.push(item);
    });

    const articleSections = Object.keys(grouped)
      .map(function (articleId) {
        const group = grouped[articleId];
        const rowHtml = group.rows
          .map(function (row) {
            return (
              "<section class=\"entry\">" +
              "<h3>第 " + row.paragraphNo + " 段</h3>" +
              "<p><strong>英文原文：</strong>" + escapeHtml(row.paragraphEn) + "</p>" +
              "<p><strong>参考译文：</strong>" + escapeHtml(row.referenceTranslation) + "</p>" +
              "<p><strong>我的译文：</strong>" + escapeHtml(row.userTranslation || "（未填写）") + "</p>" +
              "<p><strong>我的问题：</strong>" + escapeHtml(row.problem || "（未填写）") + "</p>" +
              "<p><strong>学到的表达：</strong>" + escapeHtml(row.learned || "（未填写）") + "</p>" +
              "<p><strong>可偷的句式/术语：</strong>" + escapeHtml(row.pattern || "（未填写）") + "</p>" +
              "<p><strong>下次提醒自己：</strong>" + escapeHtml(row.reminder || "（未填写）") + "</p>" +
              "</section>"
            );
          })
          .join("");

        return (
          "<article class=\"article-block\">" +
          "<h2>" + escapeHtml(group.title) + "</h2>" +
          "<p class=\"subtitle-en\">" + escapeHtml(group.titleEn) + "</p>" +
          rowHtml +
          "</article>"
        );
      })
      .join("");

    return (
      "<!doctype html>" +
      "<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\">" +
      "<title>" + escapeHtml(title) + "</title>" +
      "<style>" +
      "body{font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#274563;background:#f6fbff;padding:20px;}" +
      "h1{color:#2f628f;margin:0 0 6px;} .subtitle{color:#587a98;margin:0 0 16px;} " +
      ".article-block{background:#fff;border:1px solid #cddff1;border-radius:12px;padding:14px;margin-bottom:14px;}" +
      "h2{margin:0;color:#355f86;} .subtitle-en{margin:2px 0 10px;color:#6888a2;font-size:13px;}" +
      ".entry{border-top:1px dashed #d5e7f7;padding-top:10px;margin-top:10px;} .entry h3{margin:0 0 6px;color:#3a6c94;}" +
      "p{margin:4px 0;} strong{color:#2f5f8a;} @media print{body{background:#fff;padding:0;} .article-block{break-inside:avoid;}}" +
      "</style></head><body>" +
      "<h1>" + escapeHtml(title) + "</h1>" +
      "<p class=\"subtitle\">" + escapeHtml(subtitle) + " | 生成时间：" + escapeHtml(currentDate) + "</p>" +
      articleSections +
      "</body></html>"
    );
  }

  function exportJsonBackup() {
    const records = readAllRecords();
    const payload = {
      version: "1.0",
      storageKey: STORAGE_KEY,
      exportedAt: new Date().toISOString(),
      records: records
    };
    downloadBlob(
      "复盘备份_" + formatDateToken() + ".json",
      "application/json;charset=utf-8",
      JSON.stringify(payload, null, 2)
    );
    showSaveHint("备份已导出，可用于之后导入恢复。");
  }

  function importJsonBackupFromFile(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const text = String((event.target && event.target.result) || "");
      const parsed = safeParse(text, null);
      if (!parsed) {
        showSaveHint("导入失败：文件内容不是有效的 JSON。");
        return;
      }

      let nextRecords = null;
      if (parsed.records && typeof parsed.records === "object") {
        nextRecords = parsed.records;
      } else if (typeof parsed === "object") {
        nextRecords = parsed;
      }

      if (!nextRecords || Array.isArray(nextRecords)) {
        showSaveHint("导入失败：未识别到可恢复的复盘数据。");
        return;
      }

      writeAllRecords(nextRecords);
      loadReviewForCurrent();
      showSaveHint("复盘备份已导入，当前段内容已刷新。");
    };

    reader.onerror = function () {
      showSaveHint("导入失败：读取文件时出现问题。");
    };

    reader.readAsText(file, "utf-8");
  }

  function exportWordDoc() {
    const items = getReviewExportItems();
    if (!items.length) {
      showSaveHint("当前还没有可导出的复盘内容。");
      return;
    }

    const html = buildExportDocumentHtml(items, {
      title: "外刊笔译复盘整理版",
      subtitle: "按文章与段落整理，适合继续编辑"
    });
    downloadBlob(
      "外刊笔译复盘整理版_" + formatDateToken() + ".doc",
      "application/msword;charset=utf-8",
      html
    );
    showSaveHint("Word 整理版已导出。");
  }

  function exportPdfPrint() {
    const items = getReviewExportItems();
    if (!items.length) {
      showSaveHint("当前还没有可导出的复盘内容。");
      return;
    }

    const html = buildExportDocumentHtml(items, {
      title: "外刊笔译复盘打印版",
      subtitle: "适合阅读、打印和长期归档"
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showSaveHint("无法打开打印窗口，请允许浏览器弹窗后再试。");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function () {
      printWindow.print();
    }, 250);
    showSaveHint("已打开打印窗口，可选择“另存为 PDF”。");
  }

  function tokenize(text) {
    const tokens = [];
    let currentWord = "";
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (/\s/.test(char)) {
        if (currentWord) {
          tokens.push(currentWord);
          currentWord = "";
        }
      } else if (/[A-Za-z0-9]/.test(char)) {
        currentWord += char;
      } else {
        if (currentWord) {
          tokens.push(currentWord);
          currentWord = "";
        }
        if (/[\u4e00-\u9fff]/.test(char)) {
          tokens.push(char);
        } else {
          tokens.push(char);
        }
      }
    }
    if (currentWord) {
      tokens.push(currentWord);
    }
    return tokens;
  }

  function lcsDiff(userTokens, refTokens) {
    const n = userTokens.length;
    const m = refTokens.length;
    const dp = Array.from({ length: n + 1 }, function () {
      return Array(m + 1).fill(0);
    });

    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        if (userTokens[i] === refTokens[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (userTokens[i] === refTokens[j]) {
        ops.push({ type: "same", token: userTokens[i] });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "delete", token: userTokens[i] });
        i += 1;
      } else {
        ops.push({ type: "insert", token: refTokens[j] });
        j += 1;
      }
    }

    while (i < n) {
      ops.push({ type: "delete", token: userTokens[i] });
      i += 1;
    }

    while (j < m) {
      ops.push({ type: "insert", token: refTokens[j] });
      j += 1;
    }

    return {
      ops,
      lcsLength: dp[0][0],
      userLength: n,
      refLength: m
    };
  }

  function needSpaceBetween(a, b) {
    return /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b);
  }

  function buildDiffHtml(ops, forUser) {
    const filtered = ops.filter(function (op) {
      if (forUser) {
        return op.type !== "insert";
      }
      return op.type !== "delete";
    });

    let html = "";
    for (let i = 0; i < filtered.length; i += 1) {
      const op = filtered[i];
      const token = escapeHtml(op.token);
      let cls = "diff-token";
      if (forUser && op.type === "delete") {
        cls += " diff-extra";
      }
      if (!forUser && op.type === "insert") {
        cls += " diff-missing";
      }
      html += "<span class=\"" + cls + "\">" + token + "</span>";

      const next = filtered[i + 1];
      if (next && needSpaceBetween(op.token, next.token)) {
        html += " ";
      }
    }
    return html || "<span class=\"muted\">（暂无内容）</span>";
  }

  function getIssueAnalysis(diffResult, userText, referenceText, terminologyHints) {
    const insertCount = diffResult.ops.filter(function (op) {
      return op.type === "insert";
    }).length;
    const deleteCount = diffResult.ops.filter(function (op) {
      return op.type === "delete";
    }).length;

    const maxLen = Math.max(diffResult.userLength, diffResult.refLength, 1);
    const similarity = diffResult.lcsLength / maxLen;
    const missingRatio = insertCount / Math.max(diffResult.refLength, 1);

    const tags = [];
    const suggestions = [];

    if (missingRatio > 0.18 || insertCount >= 8) {
      tags.push("可能遗漏");
      suggestions.push("有些核心信息在参考译文中出现但在你的版本里较少，建议先把主干信息补齐，再润色表达。");
    }

    if (deleteCount >= 6) {
      tags.push("表达不同");
      suggestions.push("你使用了自己的表达路径，这很好；如果想更贴近原文信息密度，可以适度收束发挥部分。");
    }

    if (similarity >= 0.35 && similarity < 0.72) {
      tags.push("语序可优化");
      suggestions.push("当前信息覆盖不错，若把句子重心前置或分句处理，阅读会更顺。");
    }

    if (similarity < 0.9) {
      tags.push("可以更自然");
      suggestions.push("个别位置可换成更地道的中文搭配，优先处理长定语和抽象名词链。");
    }

    const missingTerms = (terminologyHints || []).filter(function (term) {
      return term && !userText.includes(term);
    });
    if (missingTerms.length >= 2) {
      tags.push("术语可统一");
      suggestions.push("这段里有术语可进一步统一，例如：" + missingTerms.slice(0, 3).join("、") + "。");
    }

    if (tags.length === 0) {
      tags.push("表达不同");
      suggestions.push("整体已经很接近参考译文，后续可只微调个别措辞，让语气更稳。 ");
    }

    let summary = "整体意思基本到位，有几处表达可以更自然。";
    if (missingRatio > 0.2) {
      summary = "核心信息已有覆盖，个别内容可能略有遗漏，补齐后会更完整。";
    } else if (tags.includes("术语可统一") || tags.includes("语序可优化")) {
      summary = "核心信息已经覆盖，术语和语序还可以再顺一点。";
    } else if (similarity > 0.82) {
      summary = "你的译文和参考译文接近度较高，重点打磨少量用词即可。";
    }

    if (!referenceText.trim()) {
      summary = "请先展开并确认参考译文，再进行更完整的对照。";
    }

    return { summary, tags, suggestions };
  }

  function renderRuleCards() {
    dom.ruleCards.innerHTML = ruleCheatSheet
      .map(function (rule) {
        return (
          "<article class=\"rule-card\">" +
          "<h4>" + escapeHtml(rule.name) + "</h4>" +
          "<p><strong>什么时候用：</strong>" + escapeHtml(rule.when) + "</p>" +
          "<p><strong>提醒：</strong>" + escapeHtml(rule.tip) + "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function buildArticleCardHtml(article, index) {
    const activeClass = index === state.articleIndex ? "active" : "";
    return (
      "<article class=\"article-card " + activeClass + "\" data-article-index=\"" + index + "\">" +
      "<h3>" + escapeHtml(article.titleZh) + "</h3>" +
      "<p class=\"muted\">" + escapeHtml(article.title) + "</p>" +
      "<div class=\"article-meta\">" +
      "<span class=\"meta-chip\">来源: " + escapeHtml(article.source) + "</span>" +
      "<span class=\"meta-chip\">日期: " + escapeHtml(article.articleDate) + "</span>" +
      "<span class=\"meta-chip\">主题: " + escapeHtml(article.topic) + "</span>" +
      "<span class=\"meta-chip\">难度: " + escapeHtml(article.difficulty) + "</span>" +
      "</div>" +
      "<p class=\"article-summary\">" + escapeHtml(article.summary) + "</p>" +
      "</article>"
    );
  }

  function bindArticleCardClicks(container) {
    container.querySelectorAll(".article-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const nextIndex = Number(card.getAttribute("data-article-index"));
        state.articleIndex = nextIndex;
        state.paragraphIndex = 0;
        state.referenceExpanded = false;
        dom.saveHint.textContent = "";
        renderAll();
      });
    });
  }

  function renderArticleCards() {
    const previewCount = Math.min(HOME_PREVIEW_COUNT, window.ARTICLES.length);
    dom.articleCount.textContent = "首页展示 " + previewCount + " 篇（共 " + window.ARTICLES.length + " 篇）";

    dom.articleList.innerHTML = window.ARTICLES
      .slice(0, previewCount)
      .map(function (article, index) {
        return buildArticleCardHtml(article, index);
      })
      .join("");

    dom.allArticleList.innerHTML = window.ARTICLES
      .map(function (article, index) {
        return buildArticleCardHtml(article, index);
      })
      .join("");

    bindArticleCardClicks(dom.articleList);
    bindArticleCardClicks(dom.allArticleList);
  }

  function toggleArticleView(showAll) {
    dom.homeArticleSection.classList.toggle("hidden", showAll);
    dom.allArticlesSection.classList.toggle("hidden", !showAll);
  }

  function renderReader() {
    const article = getCurrentArticle();
    dom.currentArticleMeta.textContent = article.titleZh + " | " + article.source;

    dom.articleReader.innerHTML = article.paragraphs
      .map(function (paragraph, pIndex) {
        return (
          "<article class=\"paragraph-item\">" +
          "<div class=\"paragraph-top\">" +
          "<span class=\"paragraph-tag\">第 " + (pIndex + 1) + " 段</span>" +
          "<button class=\"btn secondary practice-btn\" type=\"button\" data-p-index=\"" + pIndex + "\">练这一段</button>" +
          "</div>" +
          "<p>" + escapeHtml(paragraph) + "</p>" +
          "</article>"
        );
      })
      .join("");

    dom.articleReader.querySelectorAll(".practice-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.paragraphIndex = Number(btn.getAttribute("data-p-index"));
        state.referenceExpanded = false;
        dom.saveHint.textContent = "";
        renderPracticeArea();
        resetAnalysisView();
        loadReviewForCurrent();
      });
    });
  }

  function renderPracticeArea() {
    const article = getCurrentArticle();
    const paragraph = article.paragraphs[state.paragraphIndex] || "";
    const reference = article.referenceTranslations[state.paragraphIndex] || "";
    const hint = article.techniqueNotes[state.paragraphIndex] || "";

    dom.currentParagraphMeta.textContent = article.titleZh + " · 第 " + (state.paragraphIndex + 1) + " 段";
    dom.practiceSource.textContent = paragraph || "请先选择段落。";
    dom.referenceText.textContent = reference;
    dom.techniqueHint.textContent = hint ? "本段提示：" + hint : "";

    dom.referencePanel.classList.toggle("hidden", !state.referenceExpanded);
    dom.toggleReferenceBtn.textContent = state.referenceExpanded ? "收起参考译文" : "展开参考译文";
  }

  function resetAnalysisView() {
    dom.analysisSummary.textContent = "完成一段翻译后，点击“开始对照分析”查看差异与建议。";
    dom.issueTags.innerHTML = "";
    dom.myDiffView.innerHTML = "";
    dom.refDiffView.innerHTML = "";
    dom.suggestions.innerHTML = "";
  }

  function loadReviewForCurrent() {
    const records = readAllRecords();
    const record = records[getRecordKey()] || {};

    dom.myTranslation.value = record.userTranslation || "";
    dom.reviewProblem.value = record.problem || "";
    dom.reviewLearned.value = record.learned || "";
    dom.reviewPattern.value = record.pattern || "";
    dom.reviewReminder.value = record.reminder || "";
  }

  function saveReviewForCurrent() {
    const records = readAllRecords();
    records[getRecordKey()] = {
      userTranslation: dom.myTranslation.value.trim(),
      problem: dom.reviewProblem.value.trim(),
      learned: dom.reviewLearned.value.trim(),
      pattern: dom.reviewPattern.value.trim(),
      reminder: dom.reviewReminder.value.trim(),
      savedAt: new Date().toISOString()
    };
    writeAllRecords(records);
    showSaveHint("复盘已保存，下次打开同一文章同一段会自动恢复。");
  }

  function runAnalysis() {
    const article = getCurrentArticle();
    const reference = getCurrentReference();
    const userText = dom.myTranslation.value.trim();

    if (!userText) {
      dom.analysisSummary.textContent = "先写下你的译文，再开始对照分析。";
      return;
    }

    const userTokens = tokenize(userText);
    const refTokens = tokenize(reference);
    const diffResult = lcsDiff(userTokens, refTokens);

    const terminologyHints =
      (article.terminologyHints && article.terminologyHints[state.paragraphIndex]) || [];

    const issueAnalysis = getIssueAnalysis(diffResult, userText, reference, terminologyHints);

    dom.analysisSummary.textContent = issueAnalysis.summary;
    dom.issueTags.innerHTML = issueAnalysis.tags
      .map(function (tag) {
        return "<span class=\"issue-tag\">" + escapeHtml(tag) + "</span>";
      })
      .join("");

    dom.myDiffView.innerHTML = buildDiffHtml(diffResult.ops, true);
    dom.refDiffView.innerHTML = buildDiffHtml(diffResult.ops, false);

    dom.suggestions.innerHTML = issueAnalysis.suggestions
      .map(function (item) {
        return "<li>" + escapeHtml(item) + "</li>";
      })
      .join("");

    const records = readAllRecords();
    const key = getRecordKey();
    records[key] = Object.assign({}, records[key], {
      userTranslation: userText
    });
    writeAllRecords(records);
  }

  function bindEvents() {
    dom.toggleReferenceBtn.addEventListener("click", function () {
      state.referenceExpanded = !state.referenceExpanded;
      renderPracticeArea();
    });

    dom.analyzeBtn.addEventListener("click", runAnalysis);

    dom.saveReviewBtn.addEventListener("click", saveReviewForCurrent);
    dom.exportJsonBtn.addEventListener("click", exportJsonBackup);
    dom.importJsonBtn.addEventListener("click", function () {
      dom.importJsonInput.click();
    });
    dom.importJsonInput.addEventListener("change", function (event) {
      const target = event.target;
      const file = target && target.files && target.files[0];
      importJsonBackupFromFile(file);
      dom.importJsonInput.value = "";
    });
    dom.exportWordBtn.addEventListener("click", exportWordDoc);
    dom.exportPdfBtn.addEventListener("click", exportPdfPrint);
    dom.viewAllArticlesBtn.addEventListener("click", function () {
      toggleArticleView(true);
    });
    dom.backHomeBtn.addEventListener("click", function () {
      toggleArticleView(false);
    });

    dom.ruleToggleBtn.addEventListener("click", function () {
      dom.rulePanel.classList.toggle("hidden");
      const hidden = dom.rulePanel.classList.contains("hidden");
      dom.rulePanel.setAttribute("aria-hidden", hidden ? "true" : "false");
    });

    dom.closeRuleBtn.addEventListener("click", function () {
      dom.rulePanel.classList.add("hidden");
      dom.rulePanel.setAttribute("aria-hidden", "true");
    });
  }

  function renderAll() {
    renderArticleCards();
    renderReader();
    renderPracticeArea();
    resetAnalysisView();
    loadReviewForCurrent();
  }

  function init() {
    if (!window.ARTICLES || !window.ARTICLES.length) {
      dom.articleReader.innerHTML = "<p>未找到文章数据，请检查 articles.js。</p>";
      return;
    }

    bindEvents();
    renderRuleCards();
    renderAll();
  }

  init();
})();
