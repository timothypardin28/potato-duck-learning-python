document.addEventListener("DOMContentLoaded", () => {
  const navList = document.getElementById("handbook-nav-list");
  const content = document.getElementById("handbook-content");
  const searchInput = document.getElementById("handbook-search");
  const clearBtn = document.getElementById("handbook-search-clear");
  const emptyState = document.getElementById("handbook-empty");
  const navToggle = document.getElementById("handbook-nav-toggle");
  const sidebar = document.getElementById("handbook-sidebar");
  const chipBar = document.getElementById("handbook-chips");
  const topBtn = document.getElementById("handbook-top-btn");

  const GROUPS = window.HANDBOOK_GROUPS || [];

  if (GROUPS.length === 0) {
    content.innerHTML = '<p class="handbook-error">No handbook topics registered. Check that the handbook-NN-*.js files load before handbook.js.</p>';
    return;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function searchableText(section) {
    const parts = [section.title, section.tagline || "", section.keywords || ""];
    section.blocks.forEach((block) => {
      if (block.type === "table") {
        parts.push(block.head.join(" "));
        block.rows.forEach((row) => parts.push(row.join(" ")));
      } else if (block.type === "list") {
        parts.push(block.items.join(" "));
      } else if (block.type === "compare") {
        parts.push(block.bad, block.good, block.why || "");
      } else {
        parts.push(block.value);
      }
    });
    return parts.join(" ").toLowerCase();
  }

  // =========================================================================
  // Python Runtime Engine (Pyodide v0.26.2)
  // =========================================================================

  const PYTHON_RUNNER_SCRIPT = `
import ast, sys, io, traceback, time

class _QuackbitTimeout(Exception):
    pass

def _quackbit_run_cell_isolated(code_str):
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = stdout_buf
    sys.stderr = stderr_buf
    
    _start_time = time.time()
    _step_count = 0
    def _trace_func(frame, event, arg):
        nonlocal _step_count, _start_time
        _step_count += 1
        if _step_count % 500 == 0:
            if time.time() - _start_time > 5.0:
                raise _QuackbitTimeout("Cell execution timed out (5s limit). Check for infinite loops!")
        return _trace_func

    def _custom_input(prompt_text=""):
        import js
        res = js.prompt(str(prompt_text))
        if res is None:
            raise EOFError("input() cancelled by user")
        return str(res)

    builtins_dict = dict(__builtins__.__dict__ if hasattr(__builtins__, '__dict__') else __builtins__)
    builtins_dict['input'] = _custom_input

    cell_globals = {
        '__name__': '__main__',
        '__doc__': None,
        '__package__': None,
        '__annotations__': {},
        '__builtins__': builtins_dict,
    }

    result_repr = None
    has_expr = False
    error_str = None

    sys.settrace(_trace_func)
    try:
        parsed = ast.parse(code_str, filename='<cell>', mode='exec')
        if parsed.body and isinstance(parsed.body[-1], ast.Expr):
            last_expr = parsed.body.pop()
            if parsed.body:
                mod = ast.Module(body=parsed.body, type_ignores=[])
                ast.fix_missing_locations(mod)
                code_body = compile(mod, filename='<cell>', mode='exec')
                exec(code_body, cell_globals)
            expr_ast = ast.Expression(body=last_expr.value)
            ast.fix_missing_locations(expr_ast)
            expr_code = compile(expr_ast, filename='<cell>', mode='eval')
            eval_val = eval(expr_code, cell_globals)
            if eval_val is not None:
                has_expr = True
                result_repr = repr(eval_val)
        else:
            code_body = compile(parsed, filename='<cell>', mode='exec')
            exec(code_body, cell_globals)
    except _QuackbitTimeout as te:
        error_str = str(te)
    except Exception:
        raw_err = traceback.format_exc()
        lines = raw_err.splitlines()
        filtered = []
        for l in lines:
            if "_quackbit_run_cell_isolated" in l or "exec(code_body" in l or "eval(expr_code" in l:
                continue
            filtered.append(l)
        error_str = "\\n".join(filtered)
    except BaseException:
        error_str = traceback.format_exc()
    finally:
        sys.settrace(None)
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    return {
        'stdout': stdout_buf.getvalue(),
        'stderr': stderr_buf.getvalue(),
        'result': result_repr if has_expr else None,
        'error': error_str
    }
`;

  let pyodideInstance = null;
  let pyodidePromise = null;
  let executionCounter = 0;

  function initPyodideEngine() {
    const pill = document.getElementById("handbook-engine-pill");
    if (!window.loadPyodide) {
      if (pill) {
        pill.className = "handbook-engine-pill error";
        pill.innerHTML = `<span class="pill-dot"></span><span class="pill-text">Python Engine Failed</span>`;
      }
      return Promise.reject(new Error("loadPyodide is not available"));
    }

    if (pyodidePromise) return pyodidePromise;

    if (pill) {
      pill.className = "handbook-engine-pill loading";
      pill.innerHTML = `<span class="pill-dot"></span><span class="pill-text">Loading Python 3.11...</span>`;
    }

    pyodidePromise = window.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
    }).then(async (pyodide) => {
      pyodideInstance = pyodide;
      await pyodide.runPythonAsync(PYTHON_RUNNER_SCRIPT);

      if (pill) {
        pill.className = "handbook-engine-pill ready";
        pill.innerHTML = `<span class="pill-dot"></span><span class="pill-text">Python 3.11 Ready</span>`;
      }
      return pyodide;
    }).catch((err) => {
      console.error("Pyodide loading error:", err);
      if (pill) {
        pill.className = "handbook-engine-pill error";
        pill.innerHTML = `<span class="pill-dot"></span><span class="pill-text">Python Engine Offline</span>`;
      }
      throw err;
    });

    return pyodidePromise;
  }

  // Preload Pyodide engine asynchronously in background
  initPyodideEngine().catch(() => {});

  // =========================================================================
  // Notebook Cell Management
  // =========================================================================

  let cellSequence = 0;
  const originalCodeMap = new Map();

  function codeBlock(value, label) {
    cellSequence++;
    const id = `nb-cell-${cellSequence}`;
    originalCodeMap.set(id, value);

    const tag = label
      ? `<span class="handbook-cell-label-badge" title="Example topic">🏷️ ${escapeHtml(label)}</span>`
      : "";

    return `
      <div class="handbook-notebook-cell" id="${id}" data-cell-id="${id}">
        <div class="handbook-cell-toolbar">
          <div class="handbook-cell-info">
            <span class="handbook-cell-prompt" id="${id}-prompt">In [ ]:</span>
            ${tag}
          </div>
          <div class="handbook-cell-actions">
            <button type="button" class="handbook-cell-btn handbook-cell-run-btn" title="Run cell (Shift+Enter)">
              <span>▶</span> Run
            </button>
            <button type="button" class="handbook-cell-btn handbook-cell-reset-btn" title="Reset to original example">
              <span>↺</span> Reset
            </button>
            <button type="button" class="handbook-cell-btn handbook-cell-copy-btn" title="Copy code">
              <span>📋</span> Copy
            </button>
          </div>
        </div>
        <div class="handbook-cell-editor-wrap">
          <pre class="handbook-cell-pre-fallback"><code>${escapeHtml(value)}</code></pre>
          <textarea class="handbook-cell-textarea" style="display: none;" spellcheck="false" autocomplete="off" autocapitalize="off">${escapeHtml(value)}</textarea>
        </div>
        <div class="handbook-cell-output" id="${id}-output" style="display: none;">
          <div class="handbook-cell-output-bar">
            <span class="handbook-output-prompt" id="${id}-out-prompt">Out [ ]:</span>
            <div class="handbook-output-meta">
              <span class="handbook-output-duration" id="${id}-duration"></span>
              <button type="button" class="handbook-output-clear-btn" title="Clear output">✕ Clear</button>
            </div>
          </div>
          <div class="handbook-cell-output-content" id="${id}-output-content"></div>
        </div>
      </div>`;
  }

  function renderBlock(block) {
    switch (block.type) {
      case "text":
        return `<p class="handbook-text">${escapeHtml(block.value)}</p>`;

      case "sub":
        return `<h3 class="handbook-subhead">${escapeHtml(block.value)}</h3>`;

      case "syntax":
        return `
          <div class="handbook-syntax">
            <span class="handbook-syntax-label">Syntax</span>
            <code>${escapeHtml(block.value)}</code>
          </div>`;

      case "code":
        return codeBlock(block.value, block.label);

      case "list":
        return `
          <ul class="handbook-list">
            ${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>`;

      case "compare":
        return `
          <div class="handbook-compare">
            <div class="handbook-compare-side handbook-compare-bad">
              <span class="handbook-compare-label">Avoid</span>
              <pre><code>${escapeHtml(block.bad)}</code></pre>
            </div>
            <div class="handbook-compare-side handbook-compare-good">
              <span class="handbook-compare-label">Prefer</span>
              <pre><code>${escapeHtml(block.good)}</code></pre>
            </div>
            ${block.why ? `<p class="handbook-compare-why">${escapeHtml(block.why)}</p>` : ""}
          </div>`;

      case "note":
        return `
          <aside class="handbook-callout handbook-callout-note">
            <span class="handbook-callout-label">Randy's note</span>
            <p>${escapeHtml(block.value)}</p>
          </aside>`;

      case "warn":
        return `
          <aside class="handbook-callout handbook-callout-warn">
            <span class="handbook-callout-label">Careful</span>
            <p>${escapeHtml(block.value)}</p>
          </aside>`;

      case "tip":
        return `
          <aside class="handbook-callout handbook-callout-tip">
            <span class="handbook-callout-label">Shortcut</span>
            <p>${escapeHtml(block.value)}</p>
          </aside>`;

      case "table": {
        const head = block.head.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
        const rows = block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("");
        return `
          ${block.caption ? `<p class="handbook-table-caption">${escapeHtml(block.caption)}</p>` : ""}
          <div class="handbook-table-wrap">
            <table class="handbook-table">
              <thead><tr>${head}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }

      default:
        return "";
    }
  }

  function renderSection(section) {
    return `
      <article class="handbook-section" id="${section.id}" data-search="${escapeHtml(searchableText(section))}">
        <header class="handbook-section-head">
          <span class="handbook-section-icon" aria-hidden="true">${section.icon || "•"}</span>
          <div>
            <h2 class="handbook-section-title">${escapeHtml(section.title)}</h2>
          </div>
        </header>
        <div class="handbook-section-body">${section.blocks.map(renderBlock).join("")}</div>
      </article>`;
  }

  function renderGroup(group) {
    return `
      <section class="handbook-group" id="group-${group.id}" data-group="${group.id}">
        <header class="handbook-group-head">
          <span class="handbook-group-icon" aria-hidden="true">${group.icon}</span>
          <div>
            <h2 class="handbook-group-title">${escapeHtml(group.title)}</h2>
          </div>
        </header>
        ${group.sections.map(renderSection).join("")}
      </section>`;
  }

  function renderNavGroup(group) {
    const items = group.sections
      .map(
        (s) => `
        <li>
          <a href="#${s.id}" class="handbook-nav-link" data-target="${s.id}">
            ${escapeHtml(s.title)}
          </a>
        </li>`
      )
      .join("");

    return `
      <li class="handbook-nav-group" data-group="${group.id}">
        <button type="button" class="handbook-nav-group-btn is-open" data-group-toggle="${group.id}">
          <span class="handbook-nav-group-icon" aria-hidden="true">${group.icon}</span>
          <span class="handbook-nav-group-label">${escapeHtml(group.title)}</span>
          <span class="handbook-nav-chevron" aria-hidden="true">▾</span>
        </button>
        <ul class="handbook-nav-sublist is-open">${items}</ul>
      </li>`;
  }

  // Initial Content Population
  content.innerHTML = GROUPS.map(renderGroup).join("");
  navList.innerHTML = GROUPS.map(renderNavGroup).join("");

  if (chipBar) {
    chipBar.innerHTML = GROUPS.map(
      (g) => `<a href="#group-${g.id}" class="handbook-chip">${g.icon} ${escapeHtml(g.title)}</a>`
    ).join("");
  }

  // =========================================================================
  // Lazy CodeMirror Activation
  // =========================================================================

  function ensureCodeMirror(cellEl) {
    if (cellEl._cm) return cellEl._cm;
    if (!window.CodeMirror) return null;

    const textarea = cellEl.querySelector(".handbook-cell-textarea");
    const preFallback = cellEl.querySelector(".handbook-cell-pre-fallback");
    if (!textarea) return null;

    if (preFallback) preFallback.style.display = "none";
    textarea.style.display = "block";

    const cm = window.CodeMirror.fromTextArea(textarea, {
      mode: "python",
      theme: "dracula",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      lineWrapping: true,
      viewportMargin: Infinity,
      extraKeys: {
        "Tab": (cmInstance) => cmInstance.replaceSelection("    ", "end"),
        "Shift-Enter": () => runCell(cellEl),
        "Ctrl-Enter": () => runCell(cellEl),
        "Cmd-Enter": () => runCell(cellEl)
      }
    });

    cellEl._cm = cm;
    return cm;
  }

  let cellObserver = null;
  if ("IntersectionObserver" in window) {
    cellObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          ensureCodeMirror(entry.target);
          cellObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "250px 0px" });
  }

  const allCells = content.querySelectorAll(".handbook-notebook-cell");
  allCells.forEach((cellEl) => {
    if (cellObserver) {
      cellObserver.observe(cellEl);
    }
  });

  // =========================================================================
  // Notebook Cell Action Handlers (Run, Reset, Copy, Clear)
  // =========================================================================

  async function runCell(cellEl) {
    if (!cellEl) return;
    const cellId = cellEl.dataset.cellId;
    const cm = ensureCodeMirror(cellEl);
    const code = cm ? cm.getValue() : (cellEl.querySelector(".handbook-cell-textarea")?.value || "");

    const runBtn = cellEl.querySelector(".handbook-cell-run-btn");
    const promptEl = document.getElementById(`${cellId}-prompt`);
    const outputEl = document.getElementById(`${cellId}-output`);
    const outputPromptEl = document.getElementById(`${cellId}-out-prompt`);
    const outputDurationEl = document.getElementById(`${cellId}-duration`);
    const outputContentEl = document.getElementById(`${cellId}-output-content`);

    cellEl.classList.add("is-running");
    if (promptEl) promptEl.textContent = "In [*]:";
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = `<span>⏳</span> Running...`;
    }

    const startTime = performance.now();

    try {
      const pyodide = await initPyodideEngine();
      const runner = pyodide.globals.get("_quackbit_run_cell_isolated");
      const rawResult = runner(code);
      const stdout = rawResult.get("stdout") || "";
      const stderr = rawResult.get("stderr") || "";
      const resultVal = rawResult.get("result");
      const error = rawResult.get("error");
      rawResult.destroy();

      const elapsed = Math.max(1, Math.round(performance.now() - startTime));
      executionCounter++;

      cellEl.classList.remove("is-running");
      cellEl.classList.add("has-run");
      if (promptEl) promptEl.textContent = `In [${executionCounter}]:`;

      if (outputEl) {
        outputEl.style.display = "block";
        if (outputPromptEl) outputPromptEl.textContent = `Out [${executionCounter}]:`;
        if (outputDurationEl) outputDurationEl.textContent = `${elapsed}ms`;

        if (error) {
          outputContentEl.className = "handbook-cell-output-content has-error";
          outputContentEl.textContent = error;
        } else {
          outputContentEl.className = "handbook-cell-output-content";
          let html = "";
          if (stdout) {
            html += escapeHtml(stdout);
          }
          if (stderr) {
            html += `<span class="output-stderr">${escapeHtml(stderr)}</span>`;
          }
          if (resultVal !== undefined && resultVal !== null) {
            if (html && !html.endsWith("\n")) html += "\n";
            html += `<span class="output-result">${escapeHtml(resultVal)}</span>`;
          }
          if (!html) {
            html = '<span class="handbook-cell-output-empty">(Cell executed with no output)</span>';
          }
          outputContentEl.innerHTML = html;
        }
      }
    } catch (err) {
      console.error("Execution error:", err);
      const elapsed = Math.max(1, Math.round(performance.now() - startTime));
      cellEl.classList.remove("is-running");
      if (outputEl) {
        outputEl.style.display = "block";
        if (outputPromptEl) outputPromptEl.textContent = `Out [!]:`;
        if (outputDurationEl) outputDurationEl.textContent = `${elapsed}ms`;
        outputContentEl.className = "handbook-cell-output-content has-error";
        outputContentEl.textContent = String(err.message || err);
      }
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = `<span>▶</span> Run`;
      }
    }
  }

  function resetCell(cellEl) {
    if (!cellEl) return;
    const cellId = cellEl.dataset.cellId;
    const origCode = originalCodeMap.get(cellId) || "";
    const cm = cellEl._cm;
    if (cm) {
      cm.setValue(origCode);
      cm.focus();
    } else {
      const textarea = cellEl.querySelector(".handbook-cell-textarea");
      const preFallbackCode = cellEl.querySelector(".handbook-cell-pre-fallback code");
      if (textarea) textarea.value = origCode;
      if (preFallbackCode) preFallbackCode.textContent = origCode;
    }

    const resetBtn = cellEl.querySelector(".handbook-cell-reset-btn");
    if (resetBtn) {
      const origHtml = resetBtn.innerHTML;
      resetBtn.innerHTML = `<span>✓</span> Reset!`;
      setTimeout(() => {
        resetBtn.innerHTML = origHtml;
      }, 1000);
    }
  }

  function copyCell(cellEl) {
    if (!cellEl) return;
    const cm = cellEl._cm;
    const code = cm ? cm.getValue() : (cellEl.querySelector(".handbook-cell-textarea")?.value || "");
    const copyBtn = cellEl.querySelector(".handbook-cell-copy-btn");

    const done = () => {
      if (copyBtn) {
        copyBtn.classList.add("is-copied");
        copyBtn.innerHTML = `<span>✓</span> Copied!`;
        setTimeout(() => {
          copyBtn.classList.remove("is-copied");
          copyBtn.innerHTML = `<span>📋</span> Copy`;
        }, 1500);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
    } else {
      fallbackCopy(code, done);
    }
  }

  function clearCellOutput(cellEl) {
    if (!cellEl) return;
    const cellId = cellEl.dataset.cellId;
    const outputEl = document.getElementById(`${cellId}-output`);
    const outputContentEl = document.getElementById(`${cellId}-output-content`);
    if (outputEl) outputEl.style.display = "none";
    if (outputContentEl) outputContentEl.innerHTML = "";
  }

  content.addEventListener("click", (e) => {
    // Run button
    const runBtn = e.target.closest(".handbook-cell-run-btn");
    if (runBtn) {
      const cell = runBtn.closest(".handbook-notebook-cell");
      if (cell) runCell(cell);
      return;
    }

    // Reset button
    const resetBtn = e.target.closest(".handbook-cell-reset-btn");
    if (resetBtn) {
      const cell = resetBtn.closest(".handbook-notebook-cell");
      if (cell) resetCell(cell);
      return;
    }

    // Copy button (notebook cell)
    const cellCopyBtn = e.target.closest(".handbook-cell-copy-btn");
    if (cellCopyBtn) {
      const cell = cellCopyBtn.closest(".handbook-notebook-cell");
      if (cell) copyCell(cell);
      return;
    }

    // Clear output button
    const clearOutputBtn = e.target.closest(".handbook-output-clear-btn");
    if (clearOutputBtn) {
      const cell = clearOutputBtn.closest(".handbook-notebook-cell");
      if (cell) clearCellOutput(cell);
      return;
    }

    // Click into cell editor wrap activates CodeMirror if not yet initialized
    const editorWrap = e.target.closest(".handbook-cell-editor-wrap");
    if (editorWrap) {
      const cell = editorWrap.closest(".handbook-notebook-cell");
      if (cell && !cell._cm) {
        const cm = ensureCodeMirror(cell);
        if (cm) cm.focus();
      }
      return;
    }

    // Legacy copy button for non-cell code blocks (e.g. compare blocks)
    const copyBtn = e.target.closest(".handbook-copy-btn");
    if (copyBtn) {
      const code = copyBtn.parentElement.querySelector("code").textContent;
      const done = () => {
        copyBtn.textContent = "Copied";
        copyBtn.classList.add("is-copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("is-copied");
        }, 1500);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
      } else {
        fallbackCopy(code, done);
      }
    }
  });

  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "absolute";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
    }
    document.body.removeChild(area);
  }

  const sectionEls = Array.from(content.querySelectorAll(".handbook-section"));
  const groupEls = Array.from(content.querySelectorAll(".handbook-group"));
  const navLinks = Array.from(navList.querySelectorAll(".handbook-nav-link"));
  const navGroupEls = Array.from(navList.querySelectorAll(".handbook-nav-group"));

  function applySearch(term) {
    const q = term.trim().toLowerCase();
    let visible = 0;

    sectionEls.forEach((el) => {
      const match = q === "" || el.dataset.search.includes(q);
      el.classList.toggle("is-hidden", !match);
      if (match) visible += 1;
    });

    groupEls.forEach((groupEl) => {
      const anyVisible = Array.from(groupEl.querySelectorAll(".handbook-section"))
        .some((el) => !el.classList.contains("is-hidden"));
      groupEl.classList.toggle("is-hidden", !anyVisible);
    });

    navLinks.forEach((link) => {
      const el = document.getElementById(link.dataset.target);
      link.parentElement.classList.toggle("is-hidden", el.classList.contains("is-hidden"));
    });

    navGroupEls.forEach((navGroupEl) => {
      const anyVisible = Array.from(navGroupEl.querySelectorAll("li"))
        .some((li) => !li.classList.contains("is-hidden"));
      navGroupEl.classList.toggle("is-hidden", !anyVisible);
    });

    emptyState.style.display = visible === 0 ? "block" : "none";
    clearBtn.style.display = q === "" ? "none" : "block";
    if (chipBar) chipBar.style.display = q === "" ? "flex" : "none";

    // Refresh any active CodeMirror editors inside visible sections
    sectionEls.forEach((el) => {
      if (!el.classList.contains("is-hidden")) {
        const cells = el.querySelectorAll(".handbook-notebook-cell");
        cells.forEach((cell) => {
          if (cell._cm) {
            setTimeout(() => cell._cm.refresh(), 20);
          }
        });
      }
    });
  }

  searchInput.addEventListener("input", (e) => applySearch(e.target.value));

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    applySearch("");
    searchInput.focus();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      applySearch("");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput && (!document.activeElement || !document.activeElement.closest(".CodeMirror"))) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  navList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-group-toggle]");
    if (!btn) return;
    const sublist = btn.nextElementSibling;
    btn.classList.toggle("is-open");
    sublist.classList.toggle("is-open");
  });

  function scrollNavIntoView(link) {
    const linkBox = link.getBoundingClientRect();
    const navBox = sidebar.getBoundingClientRect();
    const margin = 24;

    const above = linkBox.top < navBox.top + margin;
    const below = linkBox.bottom > navBox.bottom - margin;
    if (!above && !below) return;

    const offset = linkBox.top - navBox.top - sidebar.clientHeight / 2 + linkBox.height / 2;
    sidebar.scrollTo({ top: sidebar.scrollTop + offset, behavior: "smooth" });
  }

  function setActive(id) {
    navLinks.forEach((link) => {
      const on = link.dataset.target === id;
      link.classList.toggle("is-active", on);
      if (on) {
        const groupEl = link.closest(".handbook-nav-group");
        const btn = groupEl.querySelector(".handbook-nav-group-btn");
        const sublist = groupEl.querySelector(".handbook-nav-sublist");
        btn.classList.add("is-open");
        sublist.classList.add("is-open");
        scrollNavIntoView(link);
      }
    });
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (shown.length > 0) setActive(shown[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    sectionEls.forEach((el) => observer.observe(el));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActive(link.dataset.target);
      sidebar.classList.remove("is-open");
    });
  });

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      sidebar.classList.toggle("is-open");
    });
  }

  if (topBtn) {
    window.addEventListener("scroll", () => {
      topBtn.classList.toggle("is-visible", window.scrollY > 600);
    }, { passive: true });
    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const backLink = document.getElementById("handbook-back-link");
  const from = new URLSearchParams(window.location.search).get("from");
  if (backLink && from && /^[a-z0-9_-]+\.html$/i.test(from)) {
    backLink.href = from;
    backLink.style.display = "inline-flex";
  }

  applySearch("");

  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const target = document.getElementById(hash);
    if (target && (target.classList.contains("handbook-section") || target.classList.contains("handbook-group"))) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (target.classList.contains("handbook-section")) setActive(hash);
      target.classList.add("is-landed");
      setTimeout(() => target.classList.remove("is-landed"), 2000);
    }
  }

  function startBgMusic() {
      const audio = document.getElementById('bg-music');
      if (!audio) return;

      audio.play().then(() => {
          ['click', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventType => {
              window.removeEventListener(eventType, startBgMusic);
          });
      }).catch(error => {
      });
  }

  ['click', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventType => {
      window.addEventListener(eventType, startBgMusic, { passive: true });
  });
});

function renderUserMenu(container, user) {
    document.querySelectorAll(".nav-auth-only").forEach((item) => { 
        item.hidden = !user; 
    });

    const profileNav = document.querySelector(".user-profile-nav");
    if (profileNav) {
        profileNav.hidden = !user;
    }

    if (!container) return;

    if (!user) {
        container.innerHTML = `<a href="login.html" class="login-text">Lock In!</a>`;
        return;
    }

    const page = location.pathname.split("/").pop() || "index.html";
    const name = escapeHtml(displayName(user));
    const isChapter = /^(v\d+|g\d+|boss)\.html$/i.test(page);
    const guidebookHref = isChapter ? `handbook.html?from=${page}` : "handbook.html";

    container.innerHTML = `
        <div class="user-menu">
            <button type="button" class="user-menu-toggle" aria-haspopup="true" aria-expanded="false">
                <span class="user-menu-name">${name}</span>
                <span class="user-avatar">${avatarHtml(user)}</span>
            </button>
            <div class="user-menu-dropdown" role="menu" hidden>
                <a href="stats.html" role="menuitem" class="${page === "stats.html" ? "active" : ""}">Stats</a>
                <a href="${guidebookHref}" role="menuitem" class="${page === "handbook.html" ? "active" : ""}">Guidebook</a>
                <button type="button" role="menuitem" class="user-menu-logout">Lock Out</button>
            </div>
        </div>
    `;

    const toggle = container.querySelector(".user-menu-toggle");
    const dropdown = container.querySelector(".user-menu-dropdown");

    if (toggle && dropdown) {
        toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const open = dropdown.hidden;
            closeAllMenus();
            dropdown.hidden = !open;
            toggle.setAttribute("aria-expanded", String(open));
        });
    }

    const logoutBtn = container.querySelector(".user-menu-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            clearSession();
            window.location.href = "login.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navbar = document.getElementById("main-navbar");

    if (hamburgerBtn && navbar) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isActive = navbar.classList.toggle("is-active");
            hamburgerBtn.classList.toggle("is-active", isActive);
            hamburgerBtn.setAttribute("aria-expanded", String(isActive));
        });
    }

    const profileNav = document.querySelector(".user-profile-nav");
    if (profileNav) {
        const submenuToggle = profileNav.querySelector(".submenu-toggle");
        const childMenu = profileNav.querySelector(".child-menu");
        const logoutChildBtn = profileNav.querySelector(".logout-btn");

        if (submenuToggle && childMenu) {
            submenuToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                const isHidden = childMenu.hidden;
                childMenu.hidden = !isHidden;
                profileNav.classList.toggle("is-open", isHidden);
                submenuToggle.setAttribute("aria-expanded", String(isHidden));
            });
        }

        if (logoutChildBtn) {
            logoutChildBtn.addEventListener("click", () => {
                if (window.QuackbitAccount) {
                    window.QuackbitAccount.clearSession();
                }
                window.location.href = "login.html";
            });
        }
    }

    document.addEventListener("click", (e) => {
        if (navbar && !navbar.contains(e.target) && hamburgerBtn && !hamburgerBtn.contains(e.target)) {
            navbar.classList.remove("is-active");
            hamburgerBtn.classList.remove("is-active");
        }
        if (profileNav && !profileNav.contains(e.target)) {
            const childMenu = profileNav.querySelector(".child-menu");
            if (childMenu) childMenu.hidden = true;
            profileNav.classList.remove("is-open");
        }
    });
});