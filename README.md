# Polaris LMS PDF Downloader

A lightweight Chrome Extension that adds native download capabilities directly to the Polaris LMS interface, allowing you to easily download PDF notes and study materials with a single click.

## Features
- **Direct List Downloads**: Download any note directly from the module list with a single click—no need to open each note one by one.
- **Bulk "Download All"**: Download every note in the active module sequentially with a single click.
- **"Merge All by Date"**: Combine every note in the module into a single PDF, ordered by date (oldest first).
- **Smart Filenames**: Automatically strips out messy system IDs/timestamps (e.g. `1786663546889_`) so your downloaded notes are clean and readable.
- **Viewer Integration**: Retains the floating one-click download button when viewing individual PDFs directly inside the LMS viewer.
- **Clean UI**: Seamlessly integrates into the Polaris LMS with native brand-matched styling and dark mode support.
- **Highly Optimized**: Runs efficiently in the background without slowing down your browser.

## Screenshots

**Direct Inline & Bulk "Download All" on Module View:**
<img width="1870" height="903" alt="image" src="https://github.com/user-attachments/assets/6d1d185d-d543-433d-bbb7-bcf41edd2b6d" />

<br><br>

**Injected download button on single PDF viewer:**

<img width="1900" height="866" alt="Screenshot 2026-09-03 155320" src="https://github.com/user-attachments/assets/79dcd7ca-e185-47fc-beae-77fd911c10d5" />
<br><br>

**Clean downloaded filename in the downloads bar:**

<img width="1853" height="465" alt="Screenshot 2026-09-03 155335" src="https://github.com/user-attachments/assets/df9ae78e-111c-4bc9-aea7-ddcbd7072e60" />
<br><br>

## How to Install

This extension is shared directly via GitHub. You can easily install it on your browser using "Developer Mode". It only takes 30 seconds:

1. **Download the Code**
   - Click the green **Code** button at the top right of this repository.
   - Select **Download ZIP**.
   - Extract/unzip the downloaded folder somewhere on your computer.

2. **Open Chrome Extensions**
   - Open Google Chrome.
   - Type `chrome://extensions/` into your address bar and press Enter.

3. **Enable Developer Mode**
   - In the top right corner of the Extensions page, toggle the **Developer mode** switch so it is turned **ON**.

   **See the screenshot below:**

<img width="1847" height="720" alt="image" src="https://github.com/user-attachments/assets/69c9ab0c-7793-4629-8a5f-a8d8042cdcc3" />

4. **Load the Extension**
   - Click the **Load unpacked** button that appears in the top left.
   - Select the unzipped folder you downloaded in Step 1 (Make sure you select the specific folder that contains the `manifest.json` file).

**That's it!** The extension is now active. Navigate to any subject or module on Polaris LMS:
- Click **Download** next to any note card to save it instantly.
- Or click **Download All (X)** at the top header to download all module notes at once.
- Or click **Merge All by Date (X)** to get one PDF with all the module's notes, oldest first.
- Opening an individual PDF will also show the floating **Download PDF** button at the bottom right.
