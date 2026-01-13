describe('Webextension Popup', () => {
  it('renders the popup and the inject button', async () => {
    const extensionPath = await browser.getExtensionPath();
    await browser.url(`${extensionPath}/popup/index.html`);

    await expect(browser).toHaveTitle('Popup');
    await expect($('button=Open Read Cursor')).toBeExisting();
  });
});
