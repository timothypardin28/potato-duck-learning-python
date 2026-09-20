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
    window.QuackbitAccount.renderUserMenu(authContainer, currentUser);

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