document.addEventListener("DOMContentLoaded", async () => {
    const STORIES = window.QUACKBIT_STORIES || [];
    const viewer = window.QuackbitSolutionViewer;

    const sessionRaw = sessionStorage.getItem("currentUser") ||
                       sessionStorage.getItem("activeUser") ||
                       localStorage.getItem("currentUser");

    if (!sessionRaw) {
        window.location.href = "login.html";
        return;
    }

    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionRaw);
    } catch {
        currentUser = { email: sessionRaw };
    }

    /* ---------- header ---------- */
    const authContainer = document.querySelector(".auth-buttons");
    if (authContainer) {
        const displayName = (currentUser.email || currentUser.username || "Duck Coder").split("@")[0];
        authContainer.innerHTML = `
            <span class="user-badge" title="${viewer.escapeHtml(currentUser.email || "")}">🦆 ${viewer.escapeHtml(displayName)}</span>
            <button id="logout-btn" class="logout-text">Log Out</button>
        `;
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                sessionStorage.removeItem("currentUser");
                sessionStorage.removeItem("activeUser");
                localStorage.removeItem("currentUser");
                window.location.href = "login.html";
            });
        }
    }

    const owner = (currentUser.email || currentUser.username ||
                  (currentUser.id ? `id_${currentUser.id}` : "guest")).trim().toLowerCase();

    const gridEl = document.getElementById("history-grid");
    const emptyEl = document.getElementById("history-empty");
    const countEl = document.getElementById("history-count");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const clearAllBtn = document.getElementById("clear-all-btn");

    let records = [];
    let category = "all";

    function storyFor(chapterNumber) {
        return STORIES.find((s) => s.level === chapterNumber) || null;
    }

    async function loadRecords() {
        try {
            records = await window.QuackbitSolutions.listByOwner(owner);
        } catch (err) {
            console.error("Could not read the solution archive:", err);
            records = [];
        }
        render();
    }

    function render() {
        const visible = records.filter((record) => {
            if (category === "all") return true;
            const story = storyFor(record.chapterNumber);
            return story ? story.category === category : false;
        });

        if (countEl) {
            countEl.textContent = `${records.length} of ${STORIES.length} challenges solved and saved`;
        }

        if (clearAllBtn) {
            clearAllBtn.style.display = records.length ? "inline-flex" : "none";
        }

        if (!visible.length) {
            gridEl.innerHTML = "";
            emptyEl.style.display = "block";
            emptyEl.innerHTML = records.length
                ? `<div class="empty-icon">🗂️</div>
                   <h3>Nothing saved in this category yet</h3>
                   <p>Solve a challenge in this category and the accepted code lands here automatically.</p>`
                : `<div class="empty-icon">🦆</div>
                   <h3>No saved code yet</h3>
                   <p>Every time you pass a challenge, Quackbit stores the exact code that worked. Solve your first challenge to start the archive.</p>
                   <a href="story.html" class="btn-empty-cta">Go to Stories &rarr;</a>`;
            return;
        }

        emptyEl.style.display = "none";

        gridEl.innerHTML = visible.map((record) => {
            const story = storyFor(record.chapterNumber);
            const title = record.chapterTitle || (story ? story.title : `Chapter ${record.chapterNumber}`);
            const tag = story ? `${story.categoryName} • ${story.topic}` : `Chapter ${record.chapterNumber}`;
            const icon = story ? story.icon : "📄";
            const preview = (record.code || "").split("\n").slice(0, 6).join("\n");
            const versionCount = Array.isArray(record.versions) ? record.versions.length : 0;

            return `
                <article class="history-card" data-chapter="${record.chapterNumber}">
                    <div class="history-card-head">
                        <span class="history-card-tag">${icon} ${viewer.escapeHtml(tag)}</span>
                        <span class="history-card-date">${viewer.escapeHtml(viewer.formatDate(record.updatedAt))}</span>
                    </div>
                    <h3 class="history-card-title">${viewer.escapeHtml(title)}</h3>
                    <pre class="history-card-preview">${viewer.escapeHtml(preview)}</pre>
                    <div class="history-card-meta">
                        <span>✅ ${record.solveCount || 1} accepted</span>
                        ${versionCount ? `<span>🕓 ${versionCount} earlier version${versionCount === 1 ? "" : "s"}</span>` : ""}
                    </div>
                    <div class="history-card-actions">
                        <button type="button" class="btn-history-view" data-action="view">View Code</button>
                        <button type="button" class="btn-history-copy" data-action="copy">Copy</button>
                        ${story ? `<a href="${story.url}" class="btn-history-replay">Replay ↩</a>` : ""}
                        <button type="button" class="btn-history-delete" data-action="delete" aria-label="Delete saved code">🗑</button>
                    </div>
                </article>
            `;
        }).join("");
    }

    gridEl.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const card = button.closest(".history-card");
        const chapterNumber = Number(card.dataset.chapter);
        const record = records.find((r) => r.chapterNumber === chapterNumber);
        if (!record) return;

        const action = button.dataset.action;

        if (action === "view") {
            viewer.open(record);
        } else if (action === "copy") {
            viewer.copyToClipboard(record.code || "", button);
        } else if (action === "delete") {
            if (!confirm(`Delete your saved code for "${record.chapterTitle}"? This cannot be undone.`)) return;
            await window.QuackbitSolutions.remove(owner, chapterNumber);
            await loadRecords();
        }
    });

    filterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            filterButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            category = btn.dataset.category || "all";
            render();
        });
    });

    if (clearAllBtn) {
        clearAllBtn.addEventListener("click", async () => {
            if (!confirm("Delete every saved solution for this account? This cannot be undone.")) return;
            await window.QuackbitSolutions.clearOwner(owner);
            await loadRecords();
        });
    }

    loadRecords();
});
