import * as fs from 'fs';
import { JSDOM } from 'jsdom';
async function main() {
  const buf = fs.readFileSync('/tmp/goodinspect/good.docx');
  const blob = new Blob([buf]);
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom.window; (global as any).document = dom.window.document;
  (global as any).DOMParser = dom.window.DOMParser; (global as any).XMLSerializer = dom.window.XMLSerializer;
  (global as any).Blob = dom.window.Blob; (global as any).URL = dom.window.URL;
  (global as any).Node = dom.window.Node; (global as any).Element = dom.window.Element;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).getComputedStyle = dom.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(blob, container, undefined, { inWrapper: false, breakPages: true });
  const html = container.innerHTML;
  const idx = html.indexOf('Pengertian');
  console.log('Konteks HTML:', html.substring(Math.max(0,idx-200), idx+100).replace(/\n/g,' '));
}
main();
