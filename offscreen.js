// offscreen.js - Hidden extension page that fetches note PDFs and merges them into one file.
// Extension pages can fetch storage.googleapis.com without being blocked by CORS.

const FETCH_TIMEOUT_MS = 60000;

function sendProgress(tabId, text, jobId) {
    chrome.runtime.sendMessage({ target: 'background', action: 'merge-progress', tabId, jobId, text });
}

async function mergePdfs({ notes, tabId, jobId }) {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    const failed = [];

    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        sendProgress(tabId, `Merging ${i + 1} of ${notes.length}...`, jobId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const res = await fetch(note.url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const bytes = await res.arrayBuffer();
            const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach((page) => merged.addPage(page));
        } catch (e) {
            console.error('Could not merge', note.filename, e);
            failed.push(note.title || note.filename);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    if (merged.getPageCount() === 0) {
        return { success: false, error: 'None of the PDFs could be merged', failed };
    }

    sendProgress(tabId, 'Saving merged PDF...', jobId);
    const out = await merged.save();
    const blobUrl = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
    return { success: true, blobUrl, failed, pageCount: merged.getPageCount() };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;
    if (message.action === 'merge') {
        mergePdfs(message)
            .then(sendResponse)
            .catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    }
});
