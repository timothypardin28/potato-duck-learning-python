(function (global) {
  "use strict";

  var root = document.documentElement;
  var PAGE = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var IS_CHAPTER = /^(v\d+|g\d+|boss)\.html$/.test(PAGE);
  var IS_HANDBOOK = PAGE === "handbook.html";
  var HEAVY = IS_CHAPTER || IS_HANDBOOK;

  var CAP_LIGHT = 6000;      // a normal page never waits longer than this
  var CAP_HEAVY = 30000;     // Python can genuinely take a while the first time
  var CAP_FONTS = 4000;
  var MIN_SHOW = 320;        // avoid a one-frame flash on cached pages

  var member = location.pathname.toLowerCase().match(/\/team\/([a-z]+)\//);
  if (member) root.classList.add("member-page", "member-" + member[1]);

  root.classList.add("site-booting");
  root.style.setProperty(
    "--site-loading-text",
    HEAVY ? '"Waking up the Python engine\u2026"' : '"Loading\u2026"'
  );

  var started = Date.now();
  var done = false;
  var pageFailed = false;

  // Only a real script error counts. A single failed image or CDN file
  // fires an error event too, and that must not cut the wait short.
  global.addEventListener("error", function (e) {
    if (e && e.message) pageFailed = true;
  });

  function hide() {
    if (done) return;
    done = true;
    clearTimeout(cap);
    root.classList.add("site-boot-done");
    setTimeout(function () {
      root.classList.remove("site-booting", "site-boot-done");
    }, 340);
  }

  var cap = setTimeout(hide, HEAVY ? CAP_HEAVY : CAP_LIGHT);

  function show(text) {
    done = false;
    root.style.setProperty("--site-loading-text", JSON.stringify(text || "Loading\u2026"));
    root.classList.remove("site-boot-done");
    root.classList.add("site-booting");
    clearTimeout(cap);
    cap = setTimeout(hide, CAP_LIGHT);
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, CAP_FONTS); })
    ]);
  }

  function engineSettled() {
    if (pageFailed) return true;
    var pill = document.getElementById("engine-pill") ||
               document.getElementById("handbook-engine-pill");
    if (!pill) return true;
    if (typeof global.loadPyodide !== "function") return true;    // offline
    if (IS_CHAPTER && typeof global.CodeMirror !== "function") return true;
    return /\b(ready|error)\b/.test(pill.className);
  }

  function finish() {
    fontsReady().then(function () {
      setTimeout(hide, Math.max(0, MIN_SHOW - (Date.now() - started)));
    });
  }

  function waitForPage() {
    if (!HEAVY) return finish();
    var nudged = false;
    (function poll() {
      if (done) return;
      if (engineSettled()) return finish();
      if (!nudged && Date.now() - started > 9000) {
        nudged = true;
        root.style.setProperty("--site-loading-text", '"Almost there\u2026 the first launch takes longest"');
      }
      setTimeout(poll, 200);
    })();
  }

  if (document.readyState === "complete") waitForPage();
  else global.addEventListener("load", waitForPage);

  /* ---- page to page: put the duck up as soon as a link is clicked ---- */
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(javascript|mailto|tel):/i.test(href)) return;

    var dest;
    try { dest = new URL(link.href, location.href); } catch (e) { return; }
    if (dest.origin !== location.origin) return;
    if (dest.pathname === location.pathname && dest.search === location.search) return;

    show(/\/(v\d+|g\d+|boss|handbook)\.html$/i.test(dest.pathname)
      ? "Waking up the Python engine\u2026"
      : "Loading\u2026");
  });

  global.addEventListener("pageshow", function (e) { if (e.persisted) hide(); });

  global.QuackbitLoader = { show: show, hide: hide };
})(window);
