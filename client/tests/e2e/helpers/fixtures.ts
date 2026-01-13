import { readFile } from 'node:fs/promises';

export const openFixture = async (name: string) => {
  const fileUrl = new URL(`../fixtures/${name}.html`, import.meta.url);
  const html = await readFile(fileUrl, 'utf8');
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await browser.url(dataUrl);
};
