function injectStyles() {
    if (document.getElementById('polaris-downloader-styles')) return;

    const style = document.createElement('style');
    style.id = 'polaris-downloader-styles';
    style.textContent = `
        #polaris-download-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #f99707;
            color: #ffffff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        #polaris-download-btn:hover {
            background-color: #ee9511;
        }
        #polaris-download-btn:disabled {
            background-color: #111115;
            color: #f4f4f5;
            cursor: not-allowed;
            opacity: 0.8;
        }
        #polaris-download-btn.success {
            background-color: #f8f9fa;
            color: #f99707;
            border: 1px solid #f99707;
        }
        #polaris-download-btn.error {
            background-color: #0e0e11;
            color: #ff9f0a;
            border: 1px solid #ff9f0a;
        }
    `;
    document.head.appendChild(style);
}

function checkForPdf() {
    const iframe = document.querySelector('iframe[src*="storage.googleapis.com"]') || document.querySelector('iframe[src*=".pdf"]');
    
    if (iframe) {
        if (document.getElementById('polaris-download-btn')) {
            return; 
        }

        const url = iframe.getAttribute('src') || iframe.src;
        const fileUrl = url.split('#')[0];
        const rawFilename = decodeURIComponent(fileUrl.split('/').pop()) || 'notes.pdf';
        const filename = rawFilename.replace(/^\d+[_\-\s]+/, '') || rawFilename;

        injectStyles();

        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'polaris-download-btn';
        downloadBtn.innerText = "Download PDF";

        downloadBtn.addEventListener('click', () => {
            downloadBtn.innerText = "Downloading...";
            downloadBtn.disabled = true;
            downloadBtn.classList.remove('success', 'error');

            chrome.runtime.sendMessage({
                action: "download",
                url: fileUrl,
                filename: filename,
            }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    // Handle failure
                    downloadBtn.innerText = "Download Failed";
                    downloadBtn.classList.add('error');
                    console.error("Download failed:", chrome.runtime.lastError || response?.error);
                } else {
                    // Handle success
                    downloadBtn.innerText = "Downloaded!";
                    downloadBtn.classList.add('success');
                }

                // Reset button state after a delay
                setTimeout(() => {
                    downloadBtn.innerText = "Download PDF";
                    downloadBtn.disabled = false;
                    downloadBtn.classList.remove('success', 'error');
                }, 2500);
            });
        });

        document.body.appendChild(downloadBtn);

    } else {
        const existingBtn = document.getElementById('polaris-download-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
    }
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        checkForPdf();
    }, 300);
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

checkForPdf();