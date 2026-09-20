document.addEventListener("DOMContentLoaded", () => {
    const authContainer = document.querySelector(".auth-buttons");
    const startContainer = document.querySelector(".start-container");

    const sessionRaw = sessionStorage.getItem("currentUser") || sessionStorage.getItem("activeUser") || localStorage.getItem("currentUser");
    let currentUser = null;

    if (sessionRaw) {
        try {
            currentUser = JSON.parse(sessionRaw);
        } catch {
            currentUser = { email: sessionRaw };
        }
    }

    if (authContainer) {
        window.QuackbitAccount.renderUserMenu(authContainer, currentUser);
    }

    if (startContainer) {
        if (currentUser) {
            const userIdentifier = (currentUser.email || currentUser.username || (currentUser.id ? `id_${currentUser.id}` : "guest")).trim().toLowerCase();
            const progressKey = `quackbit_progress_${userIdentifier}`;
            const currentLevel = parseInt(localStorage.getItem(progressKey) || "1", 10);
            
            function getStoryPage(lvl) {
                if (lvl <= 5) return `v${Math.max(1, lvl)}.html`;
                if (lvl <= 15) return `g${lvl - 5}.html`;
                return "boss.html";
            }

            const targetPage = getStoryPage(currentLevel);
            const buttonText = currentLevel > 1 ? `Continue Adventure &rarr;` : `Start My Journey &rarr;`;

            startContainer.innerHTML = `
                <p style="color: var(--text-muted); margin-bottom: 0.75rem; font-weight: 500;">Ready for the adventure, <strong>${window.QuackbitAccount.escapeHtml(window.QuackbitAccount.displayName(currentUser))}</strong>?</p>
                <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                    <a href="${targetPage}" class="start-btn">${buttonText}</a>
                    <a href="story.html" class="start-btn" style="background: var(--main-bg); color: var(--text-main); border: 2px solid var(--border-color); box-shadow: none;">View All Stories</a>
                </div>
            `;
        } else {
            startContainer.innerHTML = `
                <p style="color: var(--text-muted-2); margin-bottom: 0.5rem; font-weight: 500;">Lock In, Play, Code</p>
                <a href="login.html" class="start-btn">To Adventure!</a>
            `;
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

    const header = document.querySelector('.header');
    const targetSection = document.querySelector('.hero-main');
    
    if (header && targetSection) {
        const options = {
            rootMargin: "-50px 0px 0px 0px",
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    header.classList.add('header-alt');
                } else {
                    header.classList.remove('header-alt');
                }
            });
        }, options);

        observer.observe(targetSection);
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
