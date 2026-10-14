/**
 * tableColumnResize.ts — Kolom tabel bisa ditarik (resize) seperti MS Word.
 *
 * Cara pakai: panggil `setupTableColumnResize(container)` setiap kali HTML
 * dokumen selesai dirender di dalam `container` (contentEditable).
 * - Setiap tabel diberi <colgroup> dengan lebar kolom eksplisit (px).
 * - Arahkan kursor ke garis batas kanan sel → kursor berubah jadi col-resize.
 * - Tekan & tarik garis batas untuk mengubah lebar dua kolom yang bersebelahan.
 * - Perubahan tersimpan otomatis karena colgroup adalah bagian dari innerHTML
 *   yang dibaca saat menyimpan dokumen.
 *
 * Aman dipanggil berulang: tabel yang sudah diproses ditandai data-tcr="1".
 */

const PROCESSED = 'data-tcr';

function ensureColgroup(table: HTMLTableElement): void {
  if (table.getAttribute(PROCESSED) === '1') return;
  const firstRow = table.rows[0] as HTMLTableRowElement | undefined;
  if (!firstRow || firstRow.cells.length < 2) {
    table.setAttribute(PROCESSED, '1');
    return;
  }
  const colCount = firstRow.cells.length;
  let cg = table.querySelector('colgroup');
  if (!cg) {
    cg = document.createElement('colgroup');
    const tableW = table.offsetWidth || table.clientWidth || 700;
    for (let i = 0; i < colCount; i++) {
      const col = document.createElement('col');
      const cell = firstRow.cells[i] as HTMLElement;
      const w = cell.offsetWidth || Math.round(tableW / colCount);
      col.style.width = `${Math.max(30, w)}px`;
      cg.appendChild(col);
    }
    table.insertBefore(cg, table.firstChild);
  } else {
    // Pastikan setiap col punya lebar eksplisit
    const cols = Array.from(cg.querySelectorAll('col'));
    const tableW = table.offsetWidth || table.clientWidth || 700;
    for (let i = 0; i < colCount; i++) {
      let col = cols[i] as HTMLElement | undefined;
      if (!col) {
        col = document.createElement('col') as unknown as HTMLElement;
        cg.appendChild(col as unknown as Node);
      }
      if (!col.style.width) {
        const cell = firstRow.cells[i] as HTMLElement;
        col.style.width = `${Math.max(30, cell.offsetWidth || Math.round(tableW / colCount))}px`;
      }
    }
  }
  (table as HTMLElement).style.tableLayout = 'fixed';
  table.setAttribute(PROCESSED, '1');
}

interface DragState {
  table: HTMLTableElement;
  colIdx: number;
  startX: number;
  w1: number;
  w2: number;
}

function getCols(table: HTMLTableElement): HTMLElement[] {
  const cg = table.querySelector('colgroup');
  if (!cg) return [];
  return Array.from(cg.querySelectorAll('col')) as unknown as HTMLElement[];
}

function colWidthPx(col: HTMLElement): number {
  return col.offsetWidth || parseFloat(col.style.width) || 100;
}

/** Lebar garis "magnet" (px) di sekitar batas kolom untuk mulai menarik. */
const GRAB_ZONE = 7;

export function setupTableColumnResize(container: HTMLElement): void {
  // Pasang listener delegasi sekali saja per container
  if ((container as any).__tcrBound) {
    container.querySelectorAll('table').forEach((t) => ensureColgroup(t as HTMLTableElement));
    return;
  }
  (container as any).__tcrBound = true;

  let drag: DragState | null = null;

  const findBorderCell = (e: MouseEvent): { table: HTMLTableElement; cell: HTMLTableCellElement } | null => {
    const cell = (e.target as HTMLElement).closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!table || !container.contains(table)) return null;
    const r = cell.getBoundingClientRect();
    if (Math.abs(e.clientX - r.right) > GRAB_ZONE) return null;
    const row = cell.parentElement as HTMLTableRowElement | null;
    if (!row || cell.cellIndex >= row.cells.length - 1) return null;
    return { table, cell };
  };

  container.addEventListener('mousemove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.startX;
      const cols = getCols(drag.table);
      const c1 = cols[drag.colIdx];
      const c2 = cols[drag.colIdx + 1];
      if (!c1 || !c2) return;
      const nw1 = Math.max(30, drag.w1 + dx);
      const nw2 = Math.max(30, drag.w2 - dx);
      c1.style.width = `${Math.round(nw1)}px`;
      c2.style.width = `${Math.round(nw2)}px`;
      e.preventDefault();
      return;
    }
    const hit = findBorderCell(e);
    (container as HTMLElement).style.cursor = hit ? 'col-resize' : '';
  });

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const hit = findBorderCell(e);
    if (!hit) return;
    ensureColgroup(hit.table);
    const cols = getCols(hit.table);
    const c1 = cols[hit.cell.cellIndex];
    const c2 = cols[hit.cell.cellIndex + 1];
    if (!c1 || !c2) return;
    drag = {
      table: hit.table,
      colIdx: hit.cell.cellIndex,
      startX: e.clientX,
      w1: colWidthPx(c1),
      w2: colWidthPx(c2),
    };
    // Jangan letakkan kursor teks / seleksi saat menarik garis kolom
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('mouseup', () => {
    drag = null;
  });

  // Proses tabel yang sudah ada sekarang
  container.querySelectorAll('table').forEach((t) => ensureColgroup(t as HTMLTableElement));
}
