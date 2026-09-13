(function (global) {
    "use strict";

    const DB_NAME = "quackbitSolutions";
    const DB_VERSION = 1;
    const STORE = "solutions";
    const MAX_VERSIONS = 5; // how many older accepted attempts we keep

    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: "id" });
                    store.createIndex("byOwner", "owner", { unique: false });
                    store.createIndex("byChapter", "chapterNumber", { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () =>
                reject(new Error("Solution archive is blocked by another open tab."));
        });

        return dbPromise;
    }

    function makeId(owner, chapterNumber) {
        return `${String(owner || "guest").trim().toLowerCase()}::${chapterNumber}`;
    }

    function runRequest(storeMode, callback) {
        return openDB().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE], storeMode);
                    const store = transaction.objectStore(STORE);
                    let result;

                    try {
                        result = callback(store);
                    } catch (err) {
                        reject(err);
                        return;
                    }

                    transaction.oncomplete = () => resolve(result && result.value);
                    transaction.onerror = () => reject(transaction.error);
                    transaction.onabort = () => reject(transaction.error);
                })
        );
    }


    function get(owner, chapterNumber) {
        const box = {};
        return runRequest("readonly", (store) => {
            const req = store.get(makeId(owner, chapterNumber));
            req.onsuccess = () => {
                box.value = req.result || null;
            };
            return box;
        });
    }

    function listByOwner(owner) {
        const box = { value: [] };
        const ownerKey = String(owner || "guest").trim().toLowerCase();

        return runRequest("readonly", (store) => {
            const index = store.index("byOwner");
            const req = index.getAll(ownerKey);
            req.onsuccess = () => {
                const rows = req.result || [];
                rows.sort((a, b) => a.chapterNumber - b.chapterNumber);
                box.value = rows;
            };
            return box;
        });
    }


    function save(payload) {
        const owner = String(payload.owner || "guest").trim().toLowerCase();
        const chapterNumber = Number(payload.chapterNumber);
        const code = String(payload.code || "");
        const id = makeId(owner, chapterNumber);
        const now = new Date().toISOString();
        const box = {};

        return runRequest("readwrite", (store) => {
            const readReq = store.get(id);

            readReq.onsuccess = () => {
                const existing = readReq.result;
                let record;

                if (!existing) {
                    record = {
                        id,
                        owner,
                        chapterNumber,
                        chapterTitle: payload.chapterTitle || `Chapter ${chapterNumber}`,
                        code,
                        message: payload.message || "",
                        language: "python",
                        solvedAt: now,
                        updatedAt: now,
                        solveCount: 1,
                        versions: []
                    };
                } else {
                    const versions = Array.isArray(existing.versions) ? existing.versions : [];
                    // Only archive the previous accepted code if it actually changed.
                    if (existing.code && existing.code.trim() !== code.trim()) {
                        versions.unshift({
                            code: existing.code,
                            savedAt: existing.updatedAt || existing.solvedAt || now
                        });
                    }

                    record = Object.assign({}, existing, {
                        chapterTitle: payload.chapterTitle || existing.chapterTitle,
                        code,
                        message: payload.message || existing.message || "",
                        updatedAt: now,
                        solveCount: (existing.solveCount || 1) + 1,
                        versions: versions.slice(0, MAX_VERSIONS)
                    });
                }

                store.put(record);
                box.value = record;
            };

            return box;
        });
    }

    function remove(owner, chapterNumber) {
        const box = { value: true };
        return runRequest("readwrite", (store) => {
            store.delete(makeId(owner, chapterNumber));
            return box;
        });
    }

    function clearOwner(owner) {
        const ownerKey = String(owner || "guest").trim().toLowerCase();
        const box = { value: 0 };

        return runRequest("readwrite", (store) => {
            const index = store.index("byOwner");
            const req = index.openCursor(IDBKeyRange.only(ownerKey));
            req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                    cursor.delete();
                    box.value += 1;
                    cursor.continue();
                }
            };
            return box;
        });
    }

    global.QuackbitSolutions = { save, get, listByOwner, remove, clearOwner, MAX_VERSIONS };
})(window);
