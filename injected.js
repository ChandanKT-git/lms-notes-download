// injected.js - Runs in the MAIN page world to access React Fiber and memory
(function () {
    function injectButtonStyles() {
        if (document.getElementById('polaris-inline-btn-styles')) return;
        const style = document.createElement('style');
        style.id = 'polaris-inline-btn-styles';
        style.textContent = `
            .polaris-inline-dl-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background-color: #f99707;
                color: #ffffff;
                font-family: inherit;
                font-size: 12px;
                font-weight: 700;
                padding: 8px 14px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                transition: all 0.15s ease-in-out;
            }
            .polaris-inline-dl-btn:hover {
                background-color: #e08606;
            }
            .polaris-inline-dl-btn:active {
                transform: scale(0.96);
            }
            .polaris-inline-dl-btn:disabled {
                opacity: 0.75;
                cursor: not-allowed;
            }
            #polaris-download-all-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background-color: #111115;
                color: #fbbf24;
                font-family: inherit;
                font-size: 12px;
                font-weight: 700;
                padding: 8px 14px;
                border-radius: 12px;
                border: 1px solid #27272a;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                transition: all 0.15s ease-in-out;
            }
            #polaris-download-all-btn:hover {
                background-color: #1f1f23;
            }
            #polaris-download-all-btn:active {
                transform: scale(0.96);
            }
            #polaris-download-all-btn:disabled {
                opacity: 0.75;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    function findNotesInFiber() {
        const space = document.querySelector('.space-y-3');
        if (!space) return [];

        const fiberKey = Object.keys(space).find(k => k.startsWith('__reactFiber'));
        let f = space[fiberKey];

        const visited = new Set();
        let notes = [];

        function search(obj, depth = 0) {
            if (!obj || depth > 10 || visited.has(obj) || notes.length) return;
            if (typeof obj !== 'object') return;
            visited.add(obj);

            if (Array.isArray(obj)) {
                const hasUrls = obj.some(item =>
                    item && typeof item === 'object' && Object.values(item).some(v =>
                        typeof v === 'string' && (v.includes('storage.googleapis.com') || v.includes('.pdf'))
                    )
                );
                if (hasUrls) {
                    notes = obj;
                    return;
                }
            }

            if (obj instanceof Element || obj instanceof Node) return;

            for (const key of Object.getOwnPropertyNames(obj)) {
                if (key === 'stateNode' && obj[key] instanceof Element) continue;
                try { search(obj[key], depth + 1); } catch (e) { }
            }
        }

        while (f && !notes.length) {
            search(f.memoizedProps);
            search(f.memoizedState);
            f = f.return;
        }

        return notes;
    }

    function extractUrlFromNote(note) {
        if (!note || typeof note !== 'object') return null;
        for (const val of Object.values(note)) {
            if (typeof val === 'string' && (val.includes('storage.googleapis.com') || val.includes('.pdf'))) {
                return val;
            }
        }
        return null;
    }

    function normalizeText(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function getCleanFilename(url, fallbackTitle) {
        if (!url) return `${fallbackTitle || 'notes'}.pdf`;
        const cleanUrl = url.split('?')[0].split('#')[0];
        const rawFilename = decodeURIComponent(cleanUrl.split('/').pop()) || `${fallbackTitle || 'notes'}.pdf`;
        let filename = rawFilename.replace(/^\d+[_\-\s]+/, '') || rawFilename;
        if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }
        return filename;
    }

    function injectDownloadButtons() {
        const cards = document.querySelectorAll('.space-y-3 > .group');

        // If not viewing any module notes (e.g. back to folder list), clean up the Download All button
        if (!cards.length) {
            const existingAllBtn = document.getElementById('polaris-download-all-btn');
            if (existingAllBtn) existingAllBtn.remove();
            return;
        }

        const notes = findNotesInFiber();
        if (!notes.length) return;

        injectButtonStyles();

        // Build lookup maps by ID and normalized Title
        const notesById = new Map();
        const notesByTitle = new Map();

        notes.forEach((note) => {
            const url = extractUrlFromNote(note);
            if (!url) return;
            if (note.id) notesById.set(String(note.id), { note, url });
            if (note.title) notesByTitle.set(normalizeText(note.title), { note, url });
        });

        // Collect ONLY notes that are visible in the CURRENT module
        const currentModuleNotes = [];

        cards.forEach((card) => {
            const actionContainer = card.querySelector('.flex.shrink-0.items-center');
            const titleEl = card.querySelector('h3');
            const titleText = titleEl ? titleEl.textContent.trim() : '';

            // 1. Try matching by normalized title
            let matched = notesByTitle.get(normalizeText(titleText));

            // 2. Try matching by Fiber key/ID
            if (!matched) {
                const cardFiberKey = Object.keys(card).find(k => k.startsWith('__reactFiber'));
                const cardKey = card[cardFiberKey]?.key;
                if (cardKey && notesById.has(String(cardKey))) {
                    matched = notesById.get(String(cardKey));
                }
            }

            if (!matched || !matched.url) return;

            const fileUrl = matched.url;
            const filename = getCleanFilename(fileUrl, titleText);

            // Record this note for the current module's "Download All" list
            currentModuleNotes.push({
                url: fileUrl,
                filename: filename,
                title: titleText
            });

            // If this card already has the Download button, skip injecting again
            if (card.querySelector('.polaris-inline-dl-btn')) return;
            if (!actionContainer) return;

            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.className = 'polaris-inline-dl-btn';
            dlBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Download</span>
            `;

            dlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dlBtn.disabled = true;
                const originalHtml = dlBtn.innerHTML;
                dlBtn.innerText = 'Downloading...';

                window.postMessage({
                    source: 'POLARIS_DOWNLOADER',
                    action: 'download',
                    url: fileUrl,
                    filename: filename
                }, '*');

                setTimeout(() => {
                    dlBtn.innerText = 'Downloaded!';
                    setTimeout(() => {
                        dlBtn.innerHTML = originalHtml;
                        dlBtn.disabled = false;
                    }, 2000);
                }, 800);
            });

            actionContainer.appendChild(dlBtn);
        });

        // Inject/Update the "Download All" button using ONLY the current module's notes
        injectDownloadAllButton(currentModuleNotes);
    }

    function injectDownloadAllButton(currentModuleNotes) {
        const headerContainer = document.querySelector('.space-y-4 > .flex.items-center.justify-between');
        if (!headerContainer || !currentModuleNotes.length) {
            const existing = document.getElementById('polaris-download-all-btn');
            if (existing) existing.remove();
            return;
        }

        const count = currentModuleNotes.length;
        let allBtn = document.getElementById('polaris-download-all-btn');

        // If the button exists and matches the current module count and cards, keep it
        if (allBtn) {
            if (allBtn.dataset.count === String(count)) {
                return;
            }
            // If the module changed (e.g. from Module 1 [7 notes] to Module 2 [5 notes]), replace it
            allBtn.remove();
        }

        allBtn = document.createElement('button');
        allBtn.id = 'polaris-download-all-btn';
        allBtn.type = 'button';
        allBtn.dataset.count = String(count);
        allBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download All (${count})</span>
        `;

        allBtn.addEventListener('click', async () => {
            allBtn.disabled = true;
            for (let i = 0; i < currentModuleNotes.length; i++) {
                allBtn.innerText = `Downloading ${i + 1} of ${count}...`;
                window.postMessage({
                    source: 'POLARIS_DOWNLOADER',
                    action: 'download',
                    url: currentModuleNotes[i].url,
                    filename: currentModuleNotes[i].filename
                }, '*');
                await new Promise(r => setTimeout(r, 400));
            }

            allBtn.innerText = 'All Downloaded!';
            setTimeout(() => {
                allBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Download All (${count})</span>
                `;
                allBtn.disabled = false;
            }, 2500);
        });

        headerContainer.appendChild(allBtn);
    }

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            injectDownloadButtons();
        }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    injectDownloadButtons();
})();
