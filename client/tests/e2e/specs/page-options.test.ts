describe('Webextension Options Page', () => {
  it('should make options page accessible', async () => {
    const extensionPath = await browser.getExtensionPath();
    const optionsUrl = `${extensionPath}/options/index.html`;

    await browser.url(optionsUrl);

    // Ensure DOM finished loading
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 10000, interval: 100 },
    );

    await expect(browser).toHaveTitle('Options');

    // Match whatever root the page actually uses
    const rootish = await $('[id="root"], [id="app"], .rcopt-shell');
    await expect(rootish).toBeExisting();

    // Assert your Options UI actually rendered (pick a stable marker)
    await expect($('.rcopt-shell')).toBeExisting();
  });
});

