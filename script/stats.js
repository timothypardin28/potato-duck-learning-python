document.addEventListener("DOMContentLoaded", async () => {
    const Account = window.QuackbitAccount;
    const STORIES = window.QUACKBIT_STORIES || [];
    const TOTAL = STORIES.length || 16;

    let user = Account.getSession();
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const fresh = await Account.getUserByEmail(user.email);
        if (fresh) {
            Account.saveSession(fresh);
            user = Account.getSession();
        }
    } catch (err) {
        console.warn("Could not refresh user from database:", err);
    }

    const owner = Account.ownerKey(user);
    const unlocked = parseInt(localStorage.getItem(`quackbit_progress_${owner}`) || "1", 10);
    const completed = Math.min(Math.max(unlocked - 1, 0), TOTAL);

    const RANKS = [
        { min: 0,  name: "Novice Duck" },
        { min: 5,  name: "Village Duck" },
        { min: 10, name: "Guardian Duck" },
        { min: 16, name: "Legendary Duck" }
    ];

    const BADGES = [
        { icon: "🥚", name: "First Quack", need: 1, rarity: "Common", desc: "Clear your first challenge" },
        { icon: "🏡", name: "Village Graduate", need: 5, rarity: "Novice",  desc: "Clear all 5 village chapters" },
        { icon: "🛡️", name: "Guardian Breaker", need: 10, rarity: "Epic", desc: "Beat 5 guardians" },
        { icon: "🗺️", name: "Road Conqueror", need: 15, rarity: "Ancient", desc: "Beat all 10 guardians" },
        { icon: "🐍", name: "PyThorn Slayer", need: 16, rarity: "Legendary", desc: "Defeat PyThorn" }
    ];

    function renderProfile() {
        document.getElementById("stats-username").textContent = Account.displayName(user);
        document.getElementById("stats-avatar").innerHTML = Account.avatarHtml(user);
        document.getElementById("avatar-remove").hidden = !user.avatar;

        const rank = RANKS.filter((r) => completed >= r.min).pop();
        document.getElementById("stats-rank").textContent = rank.name;

        Account.renderUserMenu(document.querySelector(".auth-buttons"), user);
    }

    function renderOngoing() {
        const percent = Math.round((completed / TOTAL) * 100);
        document.getElementById("python-progress").style.width = `${percent}%`;
        document.getElementById("python-progress-track").setAttribute("aria-valuenow", String(percent));

        const chapterText = document.getElementById("python-chapter");
        const card = document.getElementById("ongoing-card");

        if (completed >= TOTAL) {
            chapterText.textContent = "All chapters cleared!";
            card.href = "story.html";
            return;
        }

        const nextLevel = completed + 1;
        const story = STORIES.find((s) => s.level === nextLevel);
        chapterText.textContent = story ? `Chapter ${nextLevel} · ${story.title}` : `Chapter ${nextLevel}`;
        card.href = story ? story.url : "story.html";
    }

    function renderNumbers() {
        const hours = Account.getFlySeconds(user) / 3600;
        document.getElementById("fly-hour").textContent = hours < 10 ? hours.toFixed(1) : Math.floor(hours);
        document.getElementById("challenges-done").textContent = completed;
    }

    function renderBadges() {
        document.getElementById("badge-list").innerHTML = BADGES.map((b) => {
            const earned = completed >= b.need;
            return `
                <li class="badge ${earned ? "earned " + b.rarity : "locked"}" title="${b.desc}">
                    <span class="badge-icon">${b.icon}</span>
                    <span class="badge-name">${b.name}</span>
                    <span class="badge-rank">${b.rarity}</span>
                </li>`;
        }).join("");
    }

    async function renderAccomplishments() {
        const list = document.getElementById("accomplishment-list");
        let rows = [];

        try {
            if (window.QuackbitSolutions) rows = await window.QuackbitSolutions.listByOwner(owner);
        } catch (err) {
            console.warn("Could not load solutions:", err);
        }

        if (!rows || rows.length === 0) {
            list.innerHTML = `<li class="empty-note">No challenges cleared yet. Your first win shows up here.</li>`;
            return;
        }

        list.innerHTML = rows.slice().reverse().map((row) => {
            const story = STORIES.find((s) => s.level === row.chapterNumber);
            const label = story ? story.categoryName : `Chapter ${row.chapterNumber}`;
            const when = new Date(row.solvedAt || row.updatedAt);
            const date = isNaN(when) ? "" : when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
            return `
                <li>
                    <span class="acc-title"><strong>${Account.escapeHtml(label)}</strong> · ${Account.escapeHtml(row.chapterTitle || "")}</span>
                    <span class="acc-date">${date}</span>
                </li>`;
        }).join("");
    }

    const modal = document.getElementById("username-modal");
    const input = document.getElementById("username-input");
    const errorEl = document.getElementById("username-error");
    const saveBtn = document.getElementById("username-save");
    const cancelBtn = document.getElementById("username-cancel");
    let modalMode = "rename";

    function openModal(mode) {
        modalMode = mode;
        const setup = mode === "setup";
        document.getElementById("username-title").textContent = setup ? "Pick Your Username" : "Rename Your Duck";
        document.getElementById("username-sub").textContent = setup
            ? "Welcome to Quackbit! Choose the name other ducks will see. You can change it later."
            : "Pick the name shown on your profile.";
        cancelBtn.textContent = setup ? "Skip for now" : "Cancel";
        input.value = user.username || "";
        errorEl.textContent = "";
        modal.hidden = false;
        input.focus();
    }

    function closeModal() {
        modal.hidden = true;
        if (modalMode === "setup") {
            history.replaceState(null, "", "stats.html");
        }
    }

    async function saveUsername() {
        errorEl.textContent = "";
        saveBtn.disabled = true;
        try {
            await Account.setUsername(user.email, input.value);
            user = Account.getSession();
            renderProfile();
            closeModal();
        } catch (err) {
            errorEl.textContent = err.message;
        } finally {
            saveBtn.disabled = false;
        }
    }

    const avatarInput = document.getElementById("avatar-input");
    const avatarError = document.getElementById("avatar-error");

    document.getElementById("stats-avatar").addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", async () => {
        const file = avatarInput.files[0];
        avatarInput.value = "";
        if (!file) return;
        avatarError.textContent = "";
        try {
            const dataUrl = await Account.resizeImageFile(file);
            await Account.setAvatar(user.email, dataUrl);
            user = Account.getSession();
            renderProfile();
        } catch (err) {
            avatarError.textContent = err.message;
        }
    });

    document.getElementById("avatar-remove").addEventListener("click", async () => {
        avatarError.textContent = "";
        try {
            await Account.setAvatar(user.email, "");
            user = Account.getSession();
            renderProfile();
        } catch (err) {
            avatarError.textContent = err.message;
        }
    });
    
    document.getElementById("rename-btn").addEventListener("click", () => openModal("rename"));
    saveBtn.addEventListener("click", saveUsername);
    cancelBtn.addEventListener("click", closeModal);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveUsername();
        if (e.key === "Escape") closeModal();
    });
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    renderProfile();
    renderOngoing();
    renderNumbers();
    renderBadges();
    await renderAccomplishments();

    if (new URLSearchParams(location.search).get("setup") === "1" && !user.username) {
        openModal("setup");
    }
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