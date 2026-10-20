import * as fs from 'fs';
import { JSDOM } from 'jsdom';
async function main() {
  const buf = fs.readFileSync('/tmp/gi/good.docx');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom.window; (global as any).document = dom.window.document;
  (global as any).DOMParser = dom.window.DOMParser; (global as any).XMLSerializer = dom.window.XMLSerializer;
  (global as any).Blob = dom.window.Blob; (global as any).URL = dom.window.URL;
  (global as any).Node = dom.window.Node; (global as any).Element = dom.window.Element;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).getComputedStyle = dom.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  // Mock URL.createObjectURL
  (global as any).URL.createObjectURL = () => 'blob:mock-' + Math.random();
  (global as any).URL.revokeObjectURL = () => {};

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(buf, container, undefined, {
    inWrapper: false, breakPages: true, renderHeaders: true, renderFooters: true, useBase64URL: true,
  });
  const html = container.innerHTML;
  const imgs = [...html.matchAll(/<img[^>]*>/g)];
  console.log('Jumlah <img> di HTML:', imgs.length);
  imgs.slice(0,3).forEach((m,i) => console.log(`img${i}:`, m[0].slice(0,120)));
  // Cek apakah ada di header
  console.log('Ada <header>?', html.includes('<header'));
}
main().catch(e => { console.error(e); process.exit(1); });
