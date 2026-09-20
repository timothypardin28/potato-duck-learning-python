window.initPreparationChapter = function (config) {
    const {
        chapterId: explicitChapterId,
        chapterNumber,
        chapterTitle,
        nextChapterUrl,
        starterCode,
        testHarness
    } = config;

    function resolveChapterId() {
        if (explicitChapterId) return String(explicitChapterId).toLowerCase().trim();

        // Derive from URL pathname (e.g., /v1.html -> v1, /g4.html -> g4, /boss.html -> boss)
        try {
            const pathParts = window.location.pathname.split("/");
            const currentFileName = pathParts[pathParts.length - 1] || "";
            const pageName = currentFileName.replace(/\.html$/i, "").toLowerCase();
            if (/^(v[1-5]|g([1-9]|10)|boss)$/.test(pageName)) {
                return pageName;
            }
        } catch {
            // ignore
        }

        // Derive from QUACKBIT_STORIES catalog if loaded
        if (Array.isArray(window.QUACKBIT_STORIES)) {
            const found = window.QUACKBIT_STORIES.find((s) => s.level === chapterNumber);
            if (found && found.id) return found.id.toLowerCase();
        }

        // Fallback map based on chapterNumber (1-5 -> v1-v5, 6-15 -> g1-g10, 16 -> boss)
        if (typeof chapterNumber === "number") {
            if (chapterNumber >= 1 && chapterNumber <= 5) return `v${chapterNumber}`;
            if (chapterNumber >= 6 && chapterNumber <= 15) return `g${chapterNumber - 5}`;
            if (chapterNumber === 16) return "boss";
        }

        return `v${chapterNumber || 1}`;
    }

    const chapterId = resolveChapterId();

    document.addEventListener("DOMContentLoaded", async () => {
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

        const authContainer = document.querySelector(".auth-buttons");
        window.QuackbitAccount.renderUserMenu(authContainer, currentUser);
        window.QuackbitAccount.startFlyTimer(currentUser);

        const userIdentifier = (currentUser.email || currentUser.username || (currentUser.id ? `id_${currentUser.id}` : "guest")).trim().toLowerCase();
        const progressKey = `quackbit_progress_${userIdentifier}`;
        const unlockedMax = parseInt(localStorage.getItem(progressKey) || "1", 10);

        if (chapterNumber > unlockedMax) {
            alert(`Chapter ${chapterNumber} is locked! You must complete earlier chapters first.`);
            window.location.href = "story.html";
            return;
        }

        const video = document.getElementById("story-video");
        const skipBtn = document.getElementById("skip-video-btn");
        const cutsceneContainer = document.getElementById("cutscene-container");
        const workspaceContainer = document.getElementById("workspace-container");
        const submitBtn = document.getElementById("submit-btn");
        const resetBtn = document.getElementById("reset-code-btn");
        const nextBtn = document.getElementById("next-chapter-btn");
        const statusMsg = document.getElementById("status-msg");
        const enginePill = document.getElementById("engine-pill");

        document.querySelectorAll("video").forEach(v => {
            let source = v.querySelector("source");
            if (!source) {
                source = document.createElement("source");
                source.type = "video/mp4";
                v.appendChild(source);
            }
            if (!source.getAttribute("src")) {
                source.src = `assets/videos/${chapterId}.mp4`;
                v.load();
            }
        });

        const textarea = document.getElementById("code-input");
        if (starterCode && !textarea.value.trim()) {
            textarea.value = starterCode;
        }

        const editor = CodeMirror.fromTextArea(textarea, {
            mode: "python",
            theme: "dracula",
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            lineWrapping: true,
            extraKeys: {
                Tab: (cm) => cm.replaceSelection("    ", "end")
            }
        });

        let resizeTimer = null;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => editor.refresh(), 150);
        });

        const drafts = window.QuackbitDrafts
            ? window.QuackbitDrafts.attach(editor, userIdentifier, chapterId, starterCode)
            : null;

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                if (confirm("Reset code to starter template?")) {
                    editor.setValue(starterCode || "");
                    if (drafts) drafts.clear();
                }
            });
        }

        let savedSolution = null;

        function renderSavedBanner() {
            const host = document.querySelector(".problem-panel");
            if (!host || !window.QuackbitSolutionViewer) return;

            let banner = document.getElementById("saved-solution-banner");

            if (!savedSolution) {
                if (banner) banner.remove();
                return;
            }

            if (!banner) {
                banner = document.createElement("div");
                banner.id = "saved-solution-banner";
                banner.className = "saved-solution-banner";
                host.insertBefore(banner, host.firstChild);
            }

            banner.innerHTML = `
                <div class="saved-banner-text">
                    <strong>✅ Solution saved for this challenge</strong>
                    <span>Last saved ${window.QuackbitSolutionViewer.formatDate(savedSolution.updatedAt)}</span>
                </div>
                <div class="saved-banner-actions">
                    <button type="button" id="view-saved-btn" class="btn-saved-view">View Saved Code</button>
                    <button type="button" id="load-saved-btn" class="btn-saved-load">Load into Editor</button>
                    <a href="history.html" class="btn-saved-all">All Saved Code &rarr;</a>
                </div>
            `;

            banner.querySelector("#view-saved-btn").addEventListener("click", () => {
                window.QuackbitSolutionViewer.open(savedSolution);
            });

            banner.querySelector("#load-saved-btn").addEventListener("click", () => {
                if (confirm("Replace the editor content with your saved solution?")) {
                    editor.setValue(savedSolution.code || "");
                    editor.focus();
                }
            });
        }

        async function refreshSavedSolution() {
            if (!window.QuackbitSolutions) return null;
            try {
                savedSolution = await window.QuackbitSolutions.get(userIdentifier, chapterNumber);
            } catch (err) {
                console.warn("Could not read the solution archive:", err);
                savedSolution = null;
            }
            renderSavedBanner();
            return savedSolution;
        }

        async function archiveSolution(code, message) {
            if (!window.QuackbitSolutions) return;
            try {
                savedSolution = await window.QuackbitSolutions.save({
                    owner: userIdentifier,
                    chapterNumber,
                    chapterTitle: chapterTitle || `Chapter ${chapterNumber}`,
                    code,
                    message
                });
                renderSavedBanner();
            } catch (err) {
                console.warn("Could not save the solution to the archive:", err);
            }
        }

        refreshSavedSolution();

        // --- Centralized Audio/Video Synchronization ---
        const bgMusic = document.getElementById("bg-music");
        let userInteracted = false;

        function isAnyVideoPlaying() {
            const allVideos = document.querySelectorAll("video");
            for (const v of allVideos) {
                if (!v.paused && !v.ended) {
                    const cutscene = v.closest("#cutscene-container");
                    if (cutscene && cutscene.style.display === "none") {
                        try { v.pause(); } catch {}
                        continue;
                    }
                    const outcome = v.closest("#outcome-container");
                    if (outcome && outcome.style.display === "none") {
                        try { v.pause(); } catch {}
                        continue;
                    }
                    return true;
                }
            }
            return false;
        }

        function updateAudioPlayback() {
            if (!bgMusic) return;

            if (isAnyVideoPlaying()) {
                if (!bgMusic.paused) {
                    bgMusic.pause();
                }
            } else {
                if (userInteracted && bgMusic.paused) {
                    bgMusic.play().catch(() => {});
                }
            }
        }

        function trackVideo(v) {
            if (!v || v.__hasAudioTracking) return;
            v.__hasAudioTracking = true;
            ["play", "playing", "pause", "ended", "emptied"].forEach(ev => {
                v.addEventListener(ev, updateAudioPlayback);
            });
        }

        document.querySelectorAll("video").forEach(trackVideo);

        const userGestures = ["click", "pointerdown", "keydown", "touchstart"];
        function onUserGesture() {
            userInteracted = true;
            updateAudioPlayback();
        }
        userGestures.forEach(ev => {
            window.addEventListener(ev, onUserGesture, { passive: true });
        });

        window.startBgMusic = function () {
            userInteracted = true;
            updateAudioPlayback();
        };

        function transitionToChallenge() {
            if (cutsceneContainer) {
                const cutsceneVideos = cutsceneContainer.querySelectorAll("video");
                cutsceneVideos.forEach(v => {
                    try {
                        if (!v.paused) v.pause();
                    } catch {}
                });
                cutsceneContainer.style.display = "none";
            } else if (video && !video.paused) {
                try { video.pause(); } catch {}
            }
            if (workspaceContainer) workspaceContainer.style.display = "flex";
            try {
                sessionStorage.setItem(`quackbit_seen_cutscene_${chapterId}`, "1");
            } catch { }

            userInteracted = true;
            updateAudioPlayback();

            setTimeout(() => {
                editor.refresh();
                editor.focus();
            }, 60);
        }

        if (video) {
            video.addEventListener("ended", transitionToChallenge);
            video.addEventListener("error", () => {
                console.warn("Video asset not found or unplayable; skip enabled.");
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener("click", transitionToChallenge);
        }

        try {
            if (sessionStorage.getItem(`quackbit_seen_cutscene_${chapterId}`) === "1") {
                transitionToChallenge();
            }
        } catch { }
        
        if (video && cutsceneContainer && cutsceneContainer.style.display !== "none") {
            const tryPlay = video.play();
            if (tryPlay && tryPlay.catch) {
                tryPlay.catch(() => {
                    video.muted = true;
                    video.play().catch(() => {});
                    const unmute = () => {
                        video.muted = false;
                        document.removeEventListener("pointerdown", unmute);
                        document.removeEventListener("keydown", unmute);
                    };
                    document.addEventListener("pointerdown", unmute);
                    document.addEventListener("keydown", unmute);
                });
            }
        }

        let pyodide = null;
        if (submitBtn) submitBtn.disabled = true;
        if (submitBtn) submitBtn.disabled = true;

        if (enginePill) {
            enginePill.className = "engine-status-pill busy";
            enginePill.innerHTML = `<span>⏳</span> Loading Python Engine...`;
        }

        try {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
            });

            if (enginePill) {
                enginePill.className = "engine-status-pill ready";
                enginePill.innerHTML = `Python 3.11 Ready`;
            }

            if (submitBtn) submitBtn.disabled = false;
        } catch (err) {
            console.error("Pyodide loading error:", err);
            if (enginePill) {
                enginePill.className = "engine-status-pill error";
                enginePill.innerHTML = `Python Engine Failed`;
            }
            if (statusMsg){
                statusMsg.style.color = "#dc2626";
                statusMsg.textContent = "Failed to load Python environment. Please refresh the page.";
            }
        }

        function showOutcomeCutscene(passed, message){
            let outcomeContainer = document.getElementById("outcome-cutscene-container");
            if (!outcomeContainer){
                outcomeContainer = document.createElement("section");
                outcomeContainer.id = "outcome-cutscene-container";
                const main = document.querySelector("main.story-main") || document.querySelector("main.preparation-main") || document.querySelector(".preparation-main") || document.body;
                main.appendChild(outcomeContainer);
            }

            const videoFilename = `${chapterId}_${passed ? "pass" : "fail"}.mp4`;
            const videoSrc = `assets/videos/${videoFilename}`;
            const nextTarget = nextChapterUrl || (nextBtn ? nextBtn.getAttribute("href") : "story.html");
            const nextText = nextBtn ? nextBtn.textContent.trim() : "Next Story &rarr;";

            outcomeContainer.innerHTML = `
                <div class="outcome-header">
                    <span class="outcome-title-badge ${passed ? 'badge-pass' : 'badge-fail'}">
                        ${passed ? 'Victory' : 'Attempt Failed'}
                    </span>
                    <h2 class="outcome-heading">
                        ${passed ? `${chapterTitle || `Chapter ${chapterNumber}`} Conquered!` : `${chapterTitle || `Chapter ${chapterNumber}`} - Try Again!`}
                    </h2>
                </div>
                <div class="outcome-video-wrapper">
                    <video id="outcome-video" playsinline controls autoplay>
                        <source src="${videoSrc}" type="video/mp4">
                        Your browser does not support HTML video.
                    </video>
                    <div id="outcome-fallback" class="outcome-fallback-card" style="display: none;">
                        <div class="outcome-fallback-icon">${passed ? '🦆✨' : '🦆💭'}</div>
                        <div class="outcome-fallback-title">${passed ? 'Chapter Challenge Completed!' : 'Keep Going, Coder!'}</div>
                        <p class="outcome-fallback-desc">
                            ${passed 
                                ? 'Great job! The cutscene animation for this milestone is currently in production.' 
                                : 'Your code did not pass all tests yet. Review the test feedback below and try again.'}
                        </p>
                        <span class="outcome-fallback-tag">Asset: ${videoFilename}</span>
                    </div>
                </div>
                <div class="outcome-footer">
                    <div class="outcome-narrative ${passed ? 'pass-narrative' : 'fail-narrative'}">
                        ${passed 
                            ? `<strong>Success!</strong> ${message || 'All test cases passed.'}`
                            : `<strong>Feedback:</strong> ${message || 'Some test cases failed.'}`}
                    </div>
                    <div class="outcome-actions">
                        <button type="button" id="outcome-skip-btn" class="btn-outcome-skip">Skip Cutscene ⏭</button>
                        <div id="outcome-final-actions" style="display: none; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            ${passed ? `
                                <a href="${nextTarget}" class="btn-outcome-next">${nextText}</a>
                                <button type="button" id="outcome-review-btn" class="btn-outcome-review">Review Code ↩</button>
                                <button type="button" id="outcome-saved-btn" class="btn-outcome-saved">Saved Code</button>
                            ` : `
                                <button type="button" id="outcome-retry-btn" class="btn-outcome-retry">Back to Editor & Try Again ↩</button>
                            `}
                        </div>
                    </div>
                </div>
            `;

            if (workspaceContainer) workspaceContainer.style.display = "none";
            outcomeContainer.style.display = "block";

            const outcomeVideo = document.getElementById("outcome-video");
            const outcomeFallback = document.getElementById("outcome-fallback");
            const outcomeSkipBtn = document.getElementById("outcome-skip-btn");
            const outcomeFinalActions = document.getElementById("outcome-final-actions");
            const outcomeReviewBtn = document.getElementById("outcome-review-btn");
            const outcomeRetryBtn = document.getElementById("outcome-retry-btn");

            if (outcomeVideo) {
                trackVideo(outcomeVideo);
            }
            updateAudioPlayback();

            let actionsRevealed = false;
            function revealOutcomeActions() {
                if (actionsRevealed) return;
                actionsRevealed = true;
                if (outcomeSkipBtn) outcomeSkipBtn.style.display = "none";
                if (outcomeFinalActions) {
                    outcomeFinalActions.style.display = "inline-flex";
                }
            }

            function handleVideoFallback() {
                if (outcomeVideo) {
                    outcomeVideo.style.display = "none";
                }
                if (outcomeFallback) {
                    outcomeFallback.style.display = "flex";
                }
                revealOutcomeActions();
                updateAudioPlayback();
            }

            function returnToEditor() {
                if (outcomeVideo && !outcomeVideo.paused) {
                    outcomeVideo.pause();
                }
                outcomeContainer.style.display = "none";
                if (workspaceContainer) {
                    workspaceContainer.style.display = "flex";
                }
                userInteracted = true;
                updateAudioPlayback();
                setTimeout(() => {
                    editor.refresh();
                    editor.focus();
                }, 60);
            }

            if (outcomeVideo) {
                outcomeVideo.addEventListener("ended", revealOutcomeActions);
                outcomeVideo.addEventListener("error", handleVideoFallback);
                const source = outcomeVideo.querySelector("source");
                if (source) {
                    source.addEventListener("error", handleVideoFallback);
                }

                const fallbackTimeout = setTimeout(() => {
                    if (outcomeVideo.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || outcomeVideo.error || outcomeVideo.readyState === 0) {
                        handleVideoFallback();
                    }
                }, 1200);

                outcomeVideo.addEventListener("loadeddata", () => {
                    clearTimeout(fallbackTimeout);
                });

                const playPromise = outcomeVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.warn("Outcome video playback interrupted or not allowed:", err);
                        if (outcomeVideo.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || outcomeVideo.error) {
                            clearTimeout(fallbackTimeout);
                            handleVideoFallback();
                        }
                    });
                }
            } else {
                revealOutcomeActions();
            }

            if (outcomeSkipBtn) {
                outcomeSkipBtn.addEventListener("click", () => {
                    if (outcomeVideo && !outcomeVideo.paused) {
                        outcomeVideo.pause();
                    }
                    revealOutcomeActions();
                    updateAudioPlayback();
                });
            }

            if (outcomeRetryBtn) {
                outcomeRetryBtn.addEventListener("click", returnToEditor);
            }

            if (outcomeReviewBtn) {
                outcomeReviewBtn.addEventListener("click", returnToEditor);
            }

            const outcomeSavedBtn = document.getElementById("outcome-saved-btn");
            if (outcomeSavedBtn) {
                outcomeSavedBtn.addEventListener("click", async () => {
                    const record = savedSolution || (await refreshSavedSolution());
                    if (record && window.QuackbitSolutionViewer) {
                        window.QuackbitSolutionViewer.open(record);
                    } else {
                        alert("No saved solution found for this chapter yet.");
                    }
                });
            }
        }

        if (submitBtn) {
            submitBtn.addEventListener("click", async () => {
                if (!pyodide) return;

                const userCode = editor.getValue();
                submitBtn.disabled = true;
                if (statusMsg) {
                    statusMsg.style.color = "#2563eb";
                    statusMsg.innerHTML = `<span>🔄</span> Validating answer...`;
                }

                const runnerScript = testHarness(userCode);

                try {
                    const pyResult = await pyodide.runPythonAsync(runnerScript);
                    const result = pyResult && pyResult.toJs ? pyResult.toJs() : pyResult;
                    if (pyResult && pyResult.destroy) {
                        pyResult.destroy();
                    }

                    const passed = result ? (result.get ? result.get("passed") : result.passed) : false;
                    const message = result ? (result.get ? result.get("msg") : result.msg) : "Unknown result";

                    if (passed) {
                        if (statusMsg) {
                            statusMsg.style.color = "#16a34a";
                            statusMsg.innerHTML = `<span>✓</span> <strong>Success!</strong> ${message}`;
                        }
                        submitBtn.style.display = "none";

                        const currentUnlocked = parseInt(localStorage.getItem(progressKey) || "1", 10);
                        const newUnlocked = Math.max(currentUnlocked, chapterNumber + 1);
                        localStorage.setItem(progressKey, newUnlocked.toString());

                        // Archive the accepted code so it can be reviewed later.
                        await archiveSolution(userCode, message);

                        if (nextBtn) {
                            nextBtn.style.display = "inline-flex";
                        }

                        showOutcomeCutscene(true, message);
                    } else {
                        if (statusMsg) {
                            statusMsg.style.color = "#dc2626";
                            statusMsg.innerHTML = `<span>✗</span> ${message}`;
                        }
                        submitBtn.disabled = false;
                        showOutcomeCutscene(false, message);
                    }
                } catch (err) {
                    const lines = (err.message || "").trim().split("\n");
                    const cleanError = lines.slice(-2).join(" ");
                    if (statusMsg) {
                        statusMsg.style.color = "#dc2626";
                        statusMsg.innerHTML = `<span>✗</span> Error: ${cleanError}`;
                    }
                    submitBtn.disabled = false;
                    showOutcomeCutscene(false, `Error: ${cleanError}`);
                }
            });
        }
    });
};
