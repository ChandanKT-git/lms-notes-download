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
            #polaris-merge-all-btn {
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
                margin-left: 8px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                transition: all 0.15s ease-in-out;
            }
            #polaris-merge-all-btn:hover {
                background-color: #e08606;
            }
            #polaris-merge-all-btn:active {
                transform: scale(0.96);
            }
            #polaris-merge-all-btn:disabled {
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

    // Turn a date-like value (ISO string, DD/MM/YYYY, epoch seconds/ms, Firestore timestamp) into epoch ms
    function parseDateValue(v) {
        if (v == null || v === '' || typeof v === 'boolean') return null;
        if (typeof v === 'number') {
            if (!Number.isFinite(v)) return null;
            const ms = v < 1e12 ? v * 1000 : v;
            return ms > 0 ? ms : null;
        }
        if (typeof v === 'string') {
            const trimmed = v.trim();
            if (/^\d{10,13}$/.test(trimmed)) return parseDateValue(Number(trimmed));
            
            // Support DD/MM/YYYY or DD-MM-YYYY formats commonly used in LMS portals
            const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
            if (dmy) {
                const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}${dmy[4]}`;
                const parsed = Date.parse(iso);
                if (Number.isFinite(parsed)) return parsed;
            }

            const t = Date.parse(trimmed);
            return Number.isFinite(t) ? t : null;
        }
        if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
        if (typeof v === 'object') {
            const s = v.seconds ?? v._seconds;
            if (typeof s === 'number' && Number.isFinite(s)) return s * 1000;
        }
        return null;
    }

    const DATE_KEYS = [
        'date', 'noteDate', 'classDate', 'lectureDate', 'sessionDate', 'scheduledAt', 'scheduled_at',
        'publishedAt', 'published_at', 'uploadedAt', 'uploaded_at', 'createdAt', 'created_at',
        'updatedAt', 'updated_at',
    ];

    // Find the best date for a note: known keys first, then any date-ish key,
    // then the upload timestamp the LMS puts at the start of the file name (e.g. 1786663546889_)
    function getNoteDate(note, url) {
        if (note && typeof note === 'object') {
            for (const key of DATE_KEYS) {
                const t = parseDateValue(note[key]);
                if (t) return t;
            }
            for (const [key, val] of Object.entries(note)) {
                if (/date|time|created|uploaded|published/i.test(key)) {
                    const t = parseDateValue(val);
                    if (t) return t;
                }
            }
        }
        return getUploadTime(url);
    }

    // Upload timestamp the LMS puts at the start of the file name (e.g. 1786663546889_)
    function getUploadTime(url) {
        if (!url) return null;
        const name = decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || '');
        const m = name.match(/^(\d{13})[_\-\s]/);
        return m ? Number(m[1]) : null;
    }

    function sanitizeFilename(str) {
        return (str || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
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
            const existingActions = document.getElementById('polaris-bulk-actions');
            if (existingActions) existingActions.remove();
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
                title: titleText,
                date: getNoteDate(matched.note, fileUrl),
                uploadTime: getUploadTime(fileUrl)
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

    const DOWNLOAD_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>`;

    const MERGE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>`;

    // Oldest first; notes without a date keep their list order and go last
    function sortNotesByDate(notes) {
        return notes
            .map((note, index) => ({ note, index }))
            .sort((a, b) => {
                const da = a.note.date, db = b.note.date;
                if (da != null && db != null && da !== db) return da - db;
                if (da == null && db != null) return 1;
                if (da != null && db == null) return -1;
                // Same day (or no date): fall back to upload time from the file name
                const ua = a.note.uploadTime, ub = b.note.uploadTime;
                if (ua == null && ub != null) return 1;
                if (ua != null && ub == null) return -1;
                if (ua != null && ua !== ub) return ua - ub;
                return a.index - b.index;
            })
            .map((x) => x.note);
    }

    function getModuleName(headerContainer) {
        const heading = headerContainer.querySelector('h1, h2, h3, h4');
        const text = heading ? heading.textContent : '';
        return sanitizeFilename(text) || 'Module Notes';
    }

    // Keep active merge state outside the DOM so re-renders don't lose status or cause duplicate merges
    const activeMerge = {
        jobId: null,
        statusText: null,
        inProgress: false
    };

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.source !== 'POLARIS_DOWNLOADER_EXT') return;

        if (event.data.type === 'merge-progress') {
            if (event.data.jobId && activeMerge.jobId && event.data.jobId !== activeMerge.jobId) return;
            activeMerge.statusText = event.data.text;
            const btn = document.getElementById('polaris-merge-all-btn');
            if (btn) btn.innerText = event.data.text;
            return;
        }

        if (event.data.type === 'merge-result') {
            if (event.data.jobId && activeMerge.jobId && event.data.jobId !== activeMerge.jobId) return;
            const result = event.data.result || {};
            let statusText = 'Merged!';
            if (!result.success) {
                console.error('[Polaris Downloader] Merge failed:', result.error, result.failed);
                statusText = 'Merge Failed';
            } else if (result.failed && result.failed.length) {
                console.warn('[Polaris Downloader] Skipped notes:', result.failed);
                statusText = `Merged (${result.failed.length} skipped)`;
            }

            activeMerge.inProgress = false;
            activeMerge.jobId = null;
            activeMerge.statusText = statusText;

            const btn = document.getElementById('polaris-merge-all-btn');
            if (btn) {
                btn.innerText = statusText;
                setTimeout(() => {
                    activeMerge.statusText = null;
                    const currentBtn = document.getElementById('polaris-merge-all-btn');
                    const wrapper = document.getElementById('polaris-bulk-actions');
                    const count = (wrapper && wrapper.dataset.count) || '';
                    if (currentBtn && !activeMerge.inProgress) {
                        currentBtn.innerHTML = `${MERGE_ICON}<span>Merge All by Date (${count})</span>`;
                        currentBtn.disabled = false;
                    }
                }, 3000);
            }
        }
    });

    function injectDownloadAllButton(currentModuleNotes) {
        const headerContainer = document.querySelector('.space-y-4 > .flex.items-center.justify-between');
        if (!headerContainer || !currentModuleNotes.length) {
            const existing = document.getElementById('polaris-bulk-actions');
            if (existing) existing.remove();
            return;
        }

        const count = currentModuleNotes.length;
        let wrapper = document.getElementById('polaris-bulk-actions');

        // If the buttons already match the current module, just refresh the note list they use
        if (wrapper && wrapper.dataset.count === String(count)) {
            wrapper._notes = currentModuleNotes;
            return;
        }
        // Module changed (e.g. Module 1 [7 notes] -> Module 2 [5 notes]): rebuild
        if (wrapper) wrapper.remove();

        wrapper = document.createElement('div');
        wrapper.id = 'polaris-bulk-actions';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.dataset.count = String(count);
        wrapper._notes = currentModuleNotes;

        // --- Download All: saves each PDF separately ---
        const allBtn = document.createElement('button');
        allBtn.id = 'polaris-download-all-btn';
        allBtn.type = 'button';
        const allBtnHtml = `${DOWNLOAD_ICON}<span>Download All (${count})</span>`;
        allBtn.innerHTML = allBtnHtml;

        allBtn.addEventListener('click', async () => {
            const notes = wrapper._notes;
            allBtn.disabled = true;
            for (let i = 0; i < notes.length; i++) {
                allBtn.innerText = `Downloading ${i + 1} of ${notes.length}...`;
                window.postMessage({
                    source: 'POLARIS_DOWNLOADER',
                    action: 'download',
                    url: notes[i].url,
                    filename: notes[i].filename
                }, '*');
                await new Promise(r => setTimeout(r, 400));
            }

            allBtn.innerText = 'All Downloaded!';
            setTimeout(() => {
                allBtn.innerHTML = allBtnHtml;
                allBtn.disabled = false;
            }, 2500);
        });

        // --- Merge All: one PDF with every note, ordered by date ---
        const mergeBtn = document.createElement('button');
        mergeBtn.id = 'polaris-merge-all-btn';
        mergeBtn.type = 'button';
        mergeBtn.title = 'Combine all notes into one PDF, ordered by date (oldest first)';
        const mergeBtnHtml = `${MERGE_ICON}<span>Merge All by Date (${count})</span>`;
        mergeBtn.innerHTML = mergeBtnHtml;

        // Reflect current merge status if this button was re-rendered mid-merge
        if (activeMerge.inProgress) {
            mergeBtn.disabled = true;
            mergeBtn.innerText = activeMerge.statusText || 'Merging...';
        } else if (activeMerge.statusText) {
            mergeBtn.disabled = true;
            mergeBtn.innerText = activeMerge.statusText;
        }

        mergeBtn.addEventListener('click', () => {
            if (activeMerge.inProgress) return;
            const sorted = sortNotesByDate(wrapper._notes);
            const filename = `${getModuleName(headerContainer)} - Merged.pdf`;
            const jobId = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 7);

            activeMerge.inProgress = true;
            activeMerge.jobId = jobId;
            activeMerge.statusText = 'Starting merge...';

            mergeBtn.disabled = true;
            mergeBtn.innerText = activeMerge.statusText;

            window.postMessage({
                source: 'POLARIS_DOWNLOADER',
                action: 'merge',
                jobId,
                filename,
                notes: sorted.map(({ url, filename, title }) => ({ url, filename, title }))
            }, '*');
        });

        wrapper.appendChild(allBtn);
        wrapper.appendChild(mergeBtn);
        headerContainer.appendChild(wrapper);
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
