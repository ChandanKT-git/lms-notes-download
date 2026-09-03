chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message: ", message);
    if (message.action === "download") {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename,
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Download error:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else if (downloadId) {
                console.log("Download started with ID: ", downloadId);
                sendResponse({ success: true, downloadId: downloadId });
            } else {
                console.log("Download failed");
                sendResponse({ success: false, error: "Unknown error" });
            }
        });
        return true;
    }
});