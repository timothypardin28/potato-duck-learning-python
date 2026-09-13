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
    if (authContainer) {
        if (currentUser) {
            const displayName = (currentUser.email || currentUser.username || "Duck Coder").split("@")[0];
            authContainer.innerHTML = `
                <span class="user-badge" title="${currentUser.email || ''}">🦆 ${displayName}</span>
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
        } else {
            authContainer.innerHTML = `<a href="login.html" class="login-text">Log In</a>`;
        }
    }

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
                statusBadge = `<span class="card-status-badge completed">✓ Completed</span>`;
            } else if (isCurrent) {
                statusBadge = `<span class="card-status-badge current">⭐ Current</span>`;
            } else {
                statusBadge = `<span class="card-status-badge locked">🔒 Locked</span>`;
            }

            let coverContent = "";
            if (isUnlocked) {
                coverContent = `
                    <div class="story-cover-wrap">
                        <img 
                            src="assets/images/${story.cover}" 
                            alt="${story.title}" 
                            class="story-cover-img"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        >
                        <div class="story-cover-fallback fallback-${story.category}" style="display: none;">
                            <span class="fallback-icon">${story.icon}</span>
                            <span class="fallback-title">${story.title}</span>
                            <span class="fallback-tag">${story.categoryName} • ${story.topic}</span>
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

    // Dev / Testing Controls
    const resetProgressBtn = document.getElementById("dev-reset-progress");
    const unlockAllBtn = document.getElementById("dev-unlock-all");

    if (resetProgressBtn) {
        resetProgressBtn.addEventListener("click", () => {
            localStorage.setItem(progressKey, "1");
            updateProgressDisplay();
            renderStories();
        });
    }

    if (unlockAllBtn) {
        unlockAllBtn.addEventListener("click", () => {
            localStorage.setItem(progressKey, STORIES.length.toString());
            updateProgressDisplay();
            renderStories();
        });
    }

    updateProgressDisplay();
    renderStories();
});
