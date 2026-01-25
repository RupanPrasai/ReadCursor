import { openFixture } from '../helpers/fixtures.js';

describe('E2E smoke', () => {
  it('loads the local fixture server', async () => {
    await openFixture('basic-article');
    await expect(browser).toHaveTitle('ReadCursor E2E Fixture');
  });
});
