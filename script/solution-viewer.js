/* ============================================================
   Quackbit - Solution Archive (view layer)
   ------------------------------------------------------------
   Shared modal used by the chapter pages (story.js) and by the
   archive page (history.js) to display a saved solution.

   Public API (window.QuackbitSolutionViewer):
     open(record)          show a saved solution in a modal
     close()               close the modal
     formatDate(iso)       human readable timestamp
     escapeHtml(text)
   ============================================================ */

(function (global) {
    "use strict";

    const MODAL_ID = "solution-modal";
    let activeEditors = [];

    function escapeHtml(text) {
        return String(text == null ? "" : text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatDate(iso) {
        if (!iso) return "Unknown date";
        const date = new Date(iso);
        if (isNaN(date.getTime())) return "Unknown date";
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    /* Renders read-only code. Uses CodeMirror when the page already
       loaded it, otherwise falls back to a plain <pre> block. */
    function renderCode(container, code) {
        container.innerHTML = "";

        if (global.CodeMirror) {
            const editor = global.CodeMirror(container, {
                value: code || "",
                mode: "python",
                theme: "dracula",
                lineNumbers: true,
                readOnly: true,
                lineWrapping: true,
                indentUnit: 4
            });
            activeEditors.push(editor);
            setTimeout(() => editor.refresh(), 30);
            return;
        }

        const pre = document.createElement("pre");
        pre.className = "solution-code-plain";
        pre.textContent = code || "";
        container.appendChild(pre);
    }

    function copyToClipboard(text, button) {
        const done = () => {
            if (!button) return;
            const original = button.textContent;
            button.textContent = "Copied!";
            button.disabled = true;
            setTimeout(() => {
                button.textContent = original;
                button.disabled = false;
            }, 1400);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else {
            fallbackCopy(text, done);
        }
    }

    function fallbackCopy(text, done) {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.position = "absolute";
        helper.style.left = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        try {
            document.execCommand("copy");
            done();
        } catch (err) {
            console.warn("Copy failed:", err);
        }
        document.body.removeChild(helper);
    }

    function close() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.remove();
        activeEditors = [];
        document.removeEventListener("keydown", onEscape);
        document.body.classList.remove("solution-modal-open");
    }

    function onEscape(event) {
        if (event.key === "Escape") close();
    }

    function open(record) {
        if (!record) return;
        close();

        const versions = Array.isArray(record.versions) ? record.versions : [];
        const solveCount = record.solveCount || 1;

        const modal = document.createElement("div");
        modal.id = MODAL_ID;
        modal.className = "solution-modal-backdrop";
        modal.innerHTML = `
            <div class="solution-modal" role="dialog" aria-modal="true" aria-label="Saved solution">
                <header class="solution-modal-header">
                    <div>
                        <span class="solution-modal-tag">✅ Accepted Solution</span>
                        <h3 class="solution-modal-title">${escapeHtml(record.chapterTitle || `Chapter ${record.chapterNumber}`)}</h3>
                        <p class="solution-modal-meta">
                            First solved ${escapeHtml(formatDate(record.solvedAt))}
                            &nbsp;•&nbsp; Last saved ${escapeHtml(formatDate(record.updatedAt))}
                            &nbsp;•&nbsp; ${solveCount} accepted submission${solveCount === 1 ? "" : "s"}
                        </p>
                    </div>
                    <button type="button" class="solution-modal-close" aria-label="Close">✕</button>
                </header>

                <div class="solution-modal-body">
                    <div class="solution-code-head">
                        <span class="solution-code-file">📄 main.py</span>
                        <button type="button" class="btn-solution-copy" data-copy="current">Copy Code</button>
                    </div>
                    <div class="solution-code-host" data-role="current-code"></div>

                    ${versions.length ? `
                        <details class="solution-versions">
                            <summary>Earlier accepted versions (${versions.length})</summary>
                            <div class="solution-versions-list" data-role="versions"></div>
                        </details>
                    ` : ""}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add("solution-modal-open");

        renderCode(modal.querySelector('[data-role="current-code"]'), record.code);

        const versionsHost = modal.querySelector('[data-role="versions"]');
        if (versionsHost) {
            versions.forEach((version, index) => {
                const block = document.createElement("div");
                block.className = "solution-version-item";
                block.innerHTML = `
                    <div class="solution-code-head">
                        <span class="solution-code-file">Version ${versions.length - index} • ${escapeHtml(formatDate(version.savedAt))}</span>
                    </div>
                    <div class="solution-code-host" data-version-host="${index}"></div>
                `;
                versionsHost.appendChild(block);
            });

            // CodeMirror needs the container to be visible before it measures.
            const details = modal.querySelector(".solution-versions");
            details.addEventListener("toggle", () => {
                if (!details.open || details.dataset.rendered === "yes") return;
                versions.forEach((version, index) => {
                    renderCode(versionsHost.querySelector(`[data-version-host="${index}"]`), version.code);
                });
                details.dataset.rendered = "yes";
            });
        }

        modal.querySelector(".solution-modal-close").addEventListener("click", close);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) close();
        });
        modal.querySelector('[data-copy="current"]').addEventListener("click", (event) => {
            copyToClipboard(record.code || "", event.currentTarget);
        });

        document.addEventListener("keydown", onEscape);
    }

    global.QuackbitSolutionViewer = { open, close, renderCode, formatDate, escapeHtml, copyToClipboard };
})(window);
