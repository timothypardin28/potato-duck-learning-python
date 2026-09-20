document.addEventListener("DOMContentLoaded", () => {
    const STORIES = window.QUACKBIT_STORIES || [];

    const sessionRaw = sessionStorage.getItem("currentUser") || 
                       sessionStorage.getItem("activeUser") || 
                       localStorage.getItem("currentUser");
    let currentUser = null;
    if (sessionRaw) {
        try {
            currentUser = JSON.parse(sessionRaw);
        } catch {
            currentUser = { email: sessionRaw };
        }
    }

    const authContainer = document.querySelector(".auth-buttons");
    window.QuackbitAccount.renderUserMenu(authContainer, currentUser);

    const userIdentifier = currentUser ? (currentUser.email || currentUser.username || (currentUser.id ? `id_${currentUser.id}` : "guest")).trim().toLowerCase() : "guest";
    const progressKey = `quackbit_progress_${userIdentifier}`;
    
    function getUnlockedLevel() {
        return parseInt(localStorage.getItem(progressKey) || "1", 10);
    }

    const gridContainer = document.getElementById("story-grid");
    const progressCountEl = document.getElementById("progress-count");
    const progressBarFillEl = document.getElementById("progress-bar-fill");
    const filterButtons = document.querySelectorAll(".filter-btn");

    let currentCategory = "all";

    function updateProgressDisplay() {
        const unlocked = getUnlockedLevel();
        const clampedUnlocked = Math.min(unlocked, STORIES.length);
        const percent = Math.round((clampedUnlocked / STORIES.length) * 100);

        if (progressCountEl) {
            progressCountEl.textContent = `${clampedUnlocked} / ${STORIES.length} Unlocked (${percent}%)`;
        }
        if (progressBarFillEl) {
            progressBarFillEl.style.width = `${percent}%`;
        }
    }

    function renderStories() {
        if (!gridContainer) return;
        const unlockedMax = getUnlockedLevel();

        const filteredStories = currentCategory === "all" 
            ? STORIES 
            : STORIES.filter(s => s.category === currentCategory);

        gridContainer.innerHTML = filteredStories.map(story => {
            const isUnlocked = story.level <= unlockedMax;
            const isCompleted = story.level < unlockedMax;
            const isCurrent = story.level === unlockedMax;

            let statusBadge = "";
            if (isCompleted) {
                statusBadge = `<span class="card-status-badge completed">Completed</span>`;
            } else if (isCurrent) {
                statusBadge = `<span class="card-status-badge current">Current</span>`;
            } else {
                statusBadge = `<span class="card-status-badge locked">Locked</span>`;
            }

            let coverContent = "";
            if (isUnlocked) {
                coverContent = `
                    <div class="story-cover-wrap">
                        <img src="${story.cover}" alt="${story.title}" class="story-cover-img">
                        <div class="story-cover-fallback fallback-${story.category}" style="display: none;">
                        </div>
                    </div>
                `;
            } else {
                coverContent = `
                    <div class="story-cover-wrap is-locked">
                        <img src="assets/images/lock.png" alt="Locked" class="story-lock-img" onerror="this.src='assets/images/lock.png'">
                        <span class="lock-label">Locked Story</span>
                    </div>
                `;
            }

            let actionBtn = "";
            if (isUnlocked) {
                actionBtn = `
                    <a href="${story.url}" class="btn-play-story">
                        ${isCompleted ? "Replay Story ↩" : "Play Story &rarr;"}
                    </a>
                `;
            } else {
                const prevStory = STORIES.find(s => s.level === story.level - 1);
                const reqText = prevStory ? `Complete ${prevStory.categoryName}` : "Locked";
                actionBtn = `
                    <button type="button" class="btn-locked-story" onclick="alert('This story is locked! Complete earlier chapters first to unlock it.')">
                        🔒 ${reqText}
                    </button>
                `;
            }

            return `
                <div class="story-card ${isUnlocked ? 'unlocked' : 'locked'}" data-story-id="${story.id}">
                    ${coverContent}
                    <div class="story-card-body">
                        <div class="story-card-header">
                            <span class="card-category-tag">${story.categoryName} • ${story.topic}</span>
                            ${statusBadge}
                        </div>
                        <h3 class="story-card-title">${story.title}</h3>
                        <p class="story-card-desc">${story.desc}</p>
                        <div class="story-card-footer">
                            ${actionBtn}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.getAttribute("data-category") || "all";
            renderStories();
        });
    });

    updateProgressDisplay();
    renderStories();
    
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