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
  let n = 0;
  (global as any).URL.createObjectURL = (b: any) => { n++; return 'blob:img-' + n; };
  (global as any).URL.revokeObjectURL = () => {};

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(buf, container, undefined, {
    inWrapper: false, breakPages: true, useBase64URL: false,
  });
  const html = container.innerHTML;
  const imgs = [...html.matchAll(/<img[^>]*>/g)];
  console.log('Jumlah img:', imgs.length);
  imgs.forEach((m,i) => console.log(`img${i}:`, m[0].slice(0,150)));
}
main().catch(e => { console.error(e); process.exit(1); });
