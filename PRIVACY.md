# Privacy Policy — ReadCursor

**Effective date:** 2026-01-01

ReadCursor is a browser extension that overlays an on-demand reading cursor on webpages. This policy explains what data ReadCursor processes, what it stores, and what it does **not** collect or share.

## Summary
- ReadCursor processes webpage text **locally on your device** to render highlights and advance the reading cursor.
- ReadCursor stores only user preferences (for example, reading speed/WPM and UI/theme settings) using Chrome’s extension storage.
- ReadCursor does **not** transmit your browsing data, page content, or personal information to any server.
- ReadCursor does **not** sell user data and does **not** share user data with third parties.

## Data ReadCursor Processes (On-Device)
ReadCursor may access and process the following data **only within the active tab where you choose to run it**:
- **Website content (text and layout):** ReadCursor reads and analyzes visible page text and layout to identify readable content and compute highlighting/word positioning for the reading cursor.
- **User interaction context:** If you use the “Start reading from here” feature, ReadCursor uses your current selection and/or pointer location to determine where to begin.

This processing occurs **locally** in your browser and is used solely to provide the extension’s reading overlay functionality.

## Data ReadCursor Stores
ReadCursor stores minimal settings to preserve your preferences across sessions, such as:
- Reading speed (WPM) and related configuration
- UI/theme preferences

Storage is performed using Chrome’s extension storage APIs. ReadCursor does not store a history of webpages you visit.

## Data ReadCursor Does NOT Collect
ReadCursor does not collect, store, or transmit:
- Personally identifiable information (name, email, address, IDs)
- Authentication data (passwords, credentials, PINs)
- Financial or payment information
- Health information
- Personal communications (emails, messages)
- Precise location data
- Full web history (a list of visited URLs)

## Data Sharing / Selling
ReadCursor:
- Does **not** sell user data.
- Does **not** share or transfer user data to third parties.
- Does **not** use or transfer data for advertising, profiling, or creditworthiness/lending decisions.

## Network Access and Remote Code
ReadCursor does not download or execute remote code. The extension runs only code packaged with the extension.

ReadCursor does not send webpage content, selections, or user settings to external servers.

## Permissions (Why They Are Needed)
ReadCursor may request the following permissions:
- **activeTab**: Allows ReadCursor to run only on the currently active tab and only after an explicit user action.
- **scripting**: Enables injecting the ReadCursor runtime into the current page when the user clicks “Open ReadCursor.”
- **contextMenus**: Adds a right-click menu item (“Start reading from here”).
- **storage**: Saves user preferences (such as WPM and UI/theme settings).
- **notifications**: Displays a user-visible message if injection is blocked on restricted pages (for example, certain Chrome-managed pages).

## Data Retention and Deletion
- Stored settings remain on your device until you change them or remove the extension.
- Uninstalling the extension removes extension data stored by Chrome.
- You can also clear extension data through Chrome’s extension settings.

## Security
ReadCursor is designed to minimize data handling by processing webpage content locally. No method of software operation is risk-free, but ReadCursor avoids transmitting user data off-device and avoids third-party data sharing.

## Children’s Privacy
ReadCursor is not designed to collect data from children and does not knowingly collect personal information from children.

## Changes to This Policy
If ReadCursor’s behavior changes in a way that materially affects privacy (for example, adding network services, analytics, or syncing), this policy will be updated before or at the time the change is released.

## Contact
For questions or concerns, please open an issue on GitHub:
- https://github.com/RupanPrasai/ReadCursor/issues
