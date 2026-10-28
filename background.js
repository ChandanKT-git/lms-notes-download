chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Messages meant for the offscreen merge page are not ours
    if (message.target === 'offscreen') return;

    if (message.action === "download") {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename,
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Download error:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else if (downloadId) {
                sendResponse({ success: true, downloadId: downloadId });
            } else {
                sendResponse({ success: false, error: "Unknown error" });
            }
        });
        return true;
    }

    if (message.action === "merge") {
        const tabId = sender.tab && sender.tab.id;
        mergeAndDownload(message.notes, message.filename, tabId)
            .then(sendResponse)
            .catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    }

    // Progress updates from the offscreen page, forwarded to the tab that asked for the merge
    if (message.action === "merge-progress" && message.tabId != null) {
        chrome.tabs.sendMessage(message.tabId, { action: "merge-progress", text: message.text }).catch(() => { });
    }
});

// --- Offscreen document management ---

let creatingOffscreen = null;
let activeMerges = 0;
const pendingMergeDownloads = new Set();

async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    if (!creatingOffscreen) {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['BLOBS'],
            justification: 'Fetch note PDFs and merge them into a single file',
        }).finally(() => { creatingOffscreen = null; });
    }
    await creatingOffscreen;
}

async function closeOffscreenIfIdle() {
    if (activeMerges > 0 || pendingMergeDownloads.size > 0) return;
    if (await chrome.offscreen.hasDocument()) {
        await chrome.offscreen.closeDocument();
    }
}

async function mergeAndDownload(notes, filename, tabId) {
    activeMerges++;
    try {
        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'merge',
            notes,
            tabId,
        });
        if (!result || !result.success) return result || { success: false, error: 'Merge failed' };

        const downloadId = await chrome.downloads.download({ url: result.blobUrl, filename });
        pendingMergeDownloads.add(downloadId);
        return { success: true, failed: result.failed, pageCount: result.pageCount };
    } finally {
        activeMerges--;
        closeOffscreenIfIdle();
    }
}

// Close the offscreen page (and free the merged PDF from memory) once the download is done
chrome.downloads.onChanged.addListener((delta) => {
    if (!pendingMergeDownloads.has(delta.id) || !delta.state) return;
    if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
        pendingMergeDownloads.delete(delta.id);
        closeOffscreenIfIdle();
    }
});
