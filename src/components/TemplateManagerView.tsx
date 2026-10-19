import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  Check, 
  AlertCircle, 
  Search, 
  ArrowRight, 
  Copy, 
  Layers, 
  RotateCcw,
  Sparkles,
  BookOpen,
  FolderPlus,
  X,
  Sliders,
  Move,
  GripVertical,
  Building2,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  RefreshCw,
  FileUp,
  Table as TableIcon,
  Columns,
  Image as ImageIcon,
  Folder,
  Eye,
  Variable
} from 'lucide-react';
import { DocumentTemplate, DocumentSection, DocumentType, FaskesProfile, MediaItem, VariableItem } from '../types';
import { 
  getStoredDocumentTemplates, 
  saveDocumentTemplate, 
  deleteDocumentTemplate, 
  resetDocumentTemplates,
  getStoredMedia,
  saveMediaItem,
  mediaExistsByDataUrl,
  getStoredVariables,
  getMargins,
  saveMargins
} from '../utils/storage';
import { extractDocxAsHtml, renderDocxToContainer } from '../utils/docxReader';
import { setupTableColumnResize } from '../utils/tableColumnResize';
import { aiExecuteBracketPrompt } from '../lib/aiAgent';

interface TemplateManagerViewProps {
  onApplyTemplateToGenerator: (template: DocumentTemplate) => void;
  profile: FaskesProfile;
}

export const TemplateManagerView: React.FC<TemplateManagerViewProps> = ({
  onApplyTemplateToGenerator,
  profile,
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>(getStoredDocumentTemplates());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Edit or Create Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);

  // Editor mode: 'form' (standard fields) or 'paper_design' (interactive drag-and-drop paper preview)
  const [editorViewMode, setEditorViewMode] = useState<'form' | 'paper_design'>('paper_design');

  // Display mode for templates with original docx: 'original_docx' or 'sections'
  const [docxDisplayMode, setDocxDisplayMode] = useState<'original_docx' | 'sections'>('original_docx');
  // Version counter: memicu render ulang tampilan asli Word (high-fidelity)
  const [docxVersion, setDocxVersion] = useState(0);
  // Palet pilihan warna font (swatch, bukan dropper)
  const [showColorPalette, setShowColorPalette] = useState(false);
  // Margin kertas editor (dibagi dengan Generator via storage)
  const [tplMarginPreset, setTplMarginPreset] = useState<'2,2,2,2' | '4,3,3,3' | '1,1,1,1' | 'custom'>(() => {
    const m = getMargins();
    if (m.top === 1 && m.left === 1 && m.right === 1 && m.bottom === 1) return '1,1,1,1';
    if (m.top === 4 && m.left === 3 && m.right === 3 && m.bottom === 3) return '4,3,3,3';
    if (m.top === 2 && m.left === 2 && m.right === 2 && m.bottom === 2) return '2,2,2,2';
    return 'custom';
  });
  const [tplCustomMargin, setTplCustomMargin] = useState(() => {
    const m = getMargins();
    return { top: m.top, left: m.left, right: m.right, bottom: m.bottom };
  });
  const tplActiveMargins = useMemo(() => {
    if (tplMarginPreset === '2,2,2,2') return { top: 2, left: 2, right: 2, bottom: 2 };
    if (tplMarginPreset === '4,3,3,3') return { top: 4, left: 3, right: 3, bottom: 3 };
    if (tplMarginPreset === '1,1,1,1') return { top: 1, left: 1, right: 1, bottom: 1 };
    return tplCustomMargin;
  }, [tplMarginPreset, tplCustomMargin]);
  useEffect(() => { saveMargins(tplActiveMargins); }, [tplActiveMargins]);
  
  // Page number currently active in the paper editor
  const [editorActivePage, setEditorActivePage] = useState<number>(1);

  // Modal to choose creation type: manual vs upload docx
  const [isCreateChoiceModalOpen, setIsCreateChoiceModalOpen] = useState(false);

  // Notice State
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const triggerNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3500);
  };

  // Drag state for reordering sections
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null);

  // ContentEditable ref
  const docxEditorRef = useRef<HTMLDivElement | null>(null);
  const paperWrapRef = useRef<HTMLDivElement | null>(null);
  const imgBoxRef = useRef<HTMLDivElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const mediaDocxUploadRef = useRef<HTMLInputElement | null>(null);

  // Media Library Integration in Editor & New Template Selection
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isMediaDocxPickerOpen, setIsMediaDocxPickerOpen] = useState(false);
  const [isMediaShelfOpen, setIsMediaShelfOpen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>(getStoredMedia());
  const [isPaperDragOver, setIsPaperDragOver] = useState(false);

  // Variables and Autocomplete in Template Editor
  const [variables, setVariables] = useState<VariableItem[]>(getStoredVariables());
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  const [autocomplete, setAutocomplete] = useState<{
    isOpen: boolean;
    query: string;
    fieldId: string;
    sectionIdx?: number;
    cursorIndex: number;
    position: { top: number; left: number };
    selectedIndex: number;
  }>({
    isOpen: false,
    query: '',
    fieldId: '',
    cursorIndex: 0,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  // Selected Image for Interactive Resizing & Drag/Alignment
  const [selectedImg, setSelectedImg] = useState<{
    element: HTMLImageElement | null;
    src: string;
    width: number;
    align: 'left' | 'center' | 'right' | 'float-left' | 'float-right' | 'melayang';
    rect: { top: number; left: number; width: number; height: number };
  } | null>(null);

  /** Ambil elemen gambar terpilih yang MASIH hidup di DOM (anti-stale). */
  const getLiveSelectedImg = (): HTMLImageElement | null => {
    if (docxEditorRef.current) {
      const marked = docxEditorRef.current.querySelector('img[data-img-sel="1"]') as HTMLImageElement | null;
      if (marked) return marked;
    }
    if (selectedImg?.element?.isConnected) return selectedImg.element;
    return null;
  };

  // Jaga overlay seleksi tetap menempel pada gambar saat halaman di-scroll/di-resize
  useEffect(() => {
    if (!selectedImg) return;
    const onScrollResize = () => positionImgOverlay();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [selectedImg]);

  /** Simpan HTML editor ke state template (dipanggil tiap ada perubahan visual). */
  const persistDocxHtml = () => {
    if (docxEditorRef.current) {
      const newHtml = docxEditorRef.current.innerHTML;
      setEditingTemplate((prev) => (prev ? { ...prev, originalDocxHtml: newHtml } : null));
    }
  };

  useEffect(() => {
    if (isEditorOpen) {
      setMediaList(getStoredMedia());
      setVariables(getStoredVariables());
      setSelectedImg(null);
    }
  }, [isEditorOpen]);

  // Kunci render terakhir agar tidak me-render ulang base64 (yang menghapus editan)
  // saat hanya ganti view (paper_design <-> form) yang me-remount div preview.
  const docxRenderKey = useRef('');
  // true = render dari base64 (upload/re-upload baru); false = pakai HTML simpanan (buka template tersimpan)
  const forceBase64Render = useRef(false);
  // Render tampilan ASLI Word (high-fidelity via docx-preview) setiap kali
  // editor dibuka atau dokumen Word diganti. Ini memperbaiki bug: sebelumnya
  // innerHTML diisi sebelum editor tampil (ref masih null) sehingga kosong.
  useEffect(() => {
    const el = docxEditorRef.current;
    const tpl = editingTemplate;
    if (
      !isEditorOpen ||
      editorViewMode !== 'paper_design' ||
      docxDisplayMode !== 'original_docx' ||
      !tpl?.originalDocxBase64 ||
      !el
    ) {
      return;
    }
    const key = `${tpl.id}|${docxVersion}|${docxDisplayMode}`;
    if (docxRenderKey.current === key) {
      // Sudah dirender untuk versi ini — bila div kosong karena remount
      // (ganti view), pulihkan HTML tersimpan yang sudah termasuk editan user.
      if (!el.innerHTML.trim() && tpl.originalDocxHtml) {
        el.innerHTML = tpl.originalDocxHtml;
      }
      setupTableColumnResize(el);
      return;
    }
    docxRenderKey.current = key;
    if (forceBase64Render.current && tpl.originalDocxBase64) {
      // Upload baru: render presisi dari file Word asli
      forceBase64Render.current = false;
      const base64 = tpl.originalDocxBase64;
      const fallbackHtml = tpl.originalDocxHtml;
      renderDocxToContainer(base64, el)
        .then(() => setupTableColumnResize(el))
        .catch(() => {
          if (fallbackHtml) el.innerHTML = fallbackHtml;
          setupTableColumnResize(el);
        });
    } else if (tpl.originalDocxHtml) {
      // Buka template tersimpan: pakai HTML simpanan (termasuk gambar yang disisipkan & editan)
      el.innerHTML = tpl.originalDocxHtml;
      setupTableColumnResize(el);
    } else if (tpl.originalDocxBase64) {
      const base64 = tpl.originalDocxBase64;
      renderDocxToContainer(base64, el)
        .then(() => setupTableColumnResize(el))
        .catch(() => {});
    }
  }, [isEditorOpen, editorViewMode, docxDisplayMode, docxVersion, editingTemplate]);

  // Click handler on paper editor to select/inspect images
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      // Tandai sebagai terpilih (untuk query ulang yang anti-stale)
      if (docxEditorRef.current) {
        docxEditorRef.current.querySelectorAll('img[data-img-sel="1"]').forEach((el) => {
          el.removeAttribute('data-img-sel');
        });
      }
      img.setAttribute('data-img-sel', '1');
      img.draggable = false;
      const r = img.getBoundingClientRect();
      const styleAlign =
        img.dataset.float === '1' ? 'melayang' :
        img.style.float === 'left' ? 'float-left' :
        img.style.float === 'right' ? 'float-right' :
        (img.style.marginLeft === 'auto' && img.style.marginRight === 'auto') || img.parentElement?.style.textAlign === 'center' ? 'center' : 'left';

      setSelectedImg({
        element: img,
        src: img.src,
        width: img.offsetWidth || img.width || 240,
        align: styleAlign,
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
      requestAnimationFrame(() => positionImgOverlay());
    } else {
      if (selectedImg && !(target.closest('.image-control-bar'))) {
        if (docxEditorRef.current) {
          docxEditorRef.current.querySelectorAll('img[data-img-sel="1"]').forEach((el) => {
            el.removeAttribute('data-img-sel');
          });
        }
        if (imgBoxRef.current) imgBoxRef.current.style.display = 'none';
        setSelectedImg(null);
      }
    }
  };

  /** Posisikan kotak overlay seleksi tepat di atas gambar terpilih. */
  const positionImgOverlay = () => {
    const img = getLiveSelectedImg();
    const wrap = paperWrapRef.current;
    const box = imgBoxRef.current;
    if (!img || !wrap || !box) return;
    const wr = wrap.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = `${r.left - wr.left}px`;
    box.style.top = `${r.top - wr.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };

  /** Jadikan gambar melayang: bebas ditaruh di mana saja di atas naskah. */
  const floatImg = (img: HTMLImageElement) => {
    const editor = docxEditorRef.current;
    if (!editor) return;
    const editorRect = editor.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    editor.style.position = 'relative';
    img.dataset.float = '1';
    img.style.position = 'absolute';
    img.style.left = `${Math.max(0, r.left - editorRect.left)}px`;
    img.style.top = `${Math.max(0, r.top - editorRect.top)}px`;
    img.style.margin = '0';
    img.style.float = 'none';
    img.style.display = 'block';
    img.style.zIndex = '20';
    img.style.cursor = 'move';
    img.setAttribute('contenteditable', 'false');
    img.draggable = false;
  };

  // Tarik gambar dengan mouse = otomatis melayang & bebas ditaruh di mana saja
  // (klik biasa tanpa geser tetap hanya memilih gambar)
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG' || !docxEditorRef.current) return;
    const img = target as HTMLImageElement;
    e.preventDefault();
    let startX = e.clientX;
    let startY = e.clientY;
    let floating = img.dataset.float === '1';
    let origLeft = parseFloat(img.style.left || '0');
    let origTop = parseFloat(img.style.top || '0');
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!floating && Math.hypot(dx, dy) < 5) return; // belum dianggap drag
      if (!floating) {
        floatImg(img);
        floating = true;
        origLeft = parseFloat(img.style.left || '0');
        origTop = parseFloat(img.style.top || '0');
        startX = ev.clientX;
        startY = ev.clientY;
        setSelectedImg((prev) => (prev ? { ...prev, align: 'melayang' } : null));
        triggerNotice('Gambar jadi melayang — bebas ditarik ke mana saja, termasuk ke atas tabel.');
      }
      moved = true;
      img.style.left = `${Math.max(0, origLeft + ev.clientX - startX)}px`;
      img.style.top = `${Math.max(0, origTop + ev.clientY - startY)}px`;
      positionImgOverlay();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) persistDocxHtml();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize langsung: tarik sudut gambar (proporsional, seperti editor Word)
  const handleImgResizeStart = (e: React.MouseEvent, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    const img = getLiveSelectedImg();
    if (!img) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = img.offsetWidth || 200;
    const startH = img.offsetHeight || 150;
    const aspect = startW / Math.max(1, startH);
    const isFloat = img.dataset.float === '1';
    const startLeft = parseFloat(img.style.left || '0');
    const startTop = parseFloat(img.style.top || '0');
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      let w = startW;
      let l = startLeft;
      let t = startTop;
      if (corner === 'se') {
        w = startW + dx;
      } else if (corner === 'sw') {
        w = startW - dx;
        l = startLeft + dx;
      } else if (corner === 'ne') {
        w = startW + dx;
        t = startTop - (w / aspect - startH);
      } else {
        w = startW - dx;
        l = startLeft + dx;
        t = startTop - (w / aspect - startH);
      }
      w = Math.max(40, Math.min(1200, w));
      const h = w / aspect;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.maxWidth = isFloat ? 'none' : '100%';
      img.style.objectFit = 'contain';
      if (isFloat) {
        img.style.left = `${Math.max(0, l)}px`;
        img.style.top = `${Math.max(0, t)}px`;
      }
      positionImgOverlay();
      setSelectedImg((prev) => (prev ? { ...prev, width: Math.round(w), element: img } : null));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      persistDocxHtml();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize selected image (pakai elemen live agar selalu berhasil)
  const handleResizeSelectedImg = (newWidthPx: number) => {
    const img = getLiveSelectedImg();
    if (!img) return;
    img.style.width = `${newWidthPx}px`;
    img.style.maxWidth = img.dataset.float === '1' ? 'none' : '100%';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
    setSelectedImg((prev) => (prev ? { ...prev, width: newWidthPx, element: img } : null));
    persistDocxHtml();
  };

  // Align selected image (pakai elemen live agar selalu berhasil)
  const handleAlignSelectedImg = (align: 'left' | 'center' | 'right' | 'float-left' | 'float-right' | 'melayang') => {
    const img = getLiveSelectedImg();
    if (!img || !docxEditorRef.current) return;
    const editor = docxEditorRef.current;
    if (align === 'melayang') {
      // Mode melayang: gambar bebas ditaruh di mana saja di atas naskah
      floatImg(img);
      triggerNotice('Mode melayang aktif: tarik gambar untuk menaruh di mana saja.');
    } else {
      // Kembali ke alur teks normal
      delete img.dataset.float;
      img.style.position = '';
      img.style.left = '';
      img.style.top = '';
      img.style.zIndex = '';
      img.style.cursor = '';
      img.removeAttribute('contenteditable');
      img.draggable = false;
      if (align === 'center') {
      img.style.display = 'block';
      img.style.margin = '14px auto';
      img.style.float = 'none';
    } else if (align === 'left') {
      img.style.display = 'block';
      img.style.margin = '12px 0';
      img.style.float = 'none';
    } else if (align === 'right') {
      img.style.display = 'block';
      img.style.margin = '12px 0 12px auto';
      img.style.float = 'none';
    } else if (align === 'float-left') {
      img.style.display = 'inline-block';
      img.style.float = 'left';
      img.style.margin = '8px 16px 12px 0';
    } else if (align === 'float-right') {
      img.style.display = 'inline-block';
      img.style.float = 'right';
      img.style.margin = '8px 0 12px 16px';
      }
    }
    setSelectedImg((prev) => (prev ? { ...prev, align, element: img } : null));
    persistDocxHtml();
  };

  // Delete selected image
  const handleDeleteSelectedImg = () => {
    if (!selectedImg || !selectedImg.element) return;
    selectedImg.element.remove();
    setSelectedImg(null);
    if (docxEditorRef.current) {
      const newHtml = docxEditorRef.current.innerHTML;
      setEditingTemplate((prev) => prev ? { ...prev, originalDocxHtml: newHtml } : null);
    }
    triggerNotice('Gambar berhasil dihapus dari naskah.');
  };

  // Autocomplete matching variables for {{
  const matchingAutocompleteVariables = useMemo(() => {
    if (!autocomplete.isOpen) return [];
    const q = (autocomplete.query || '').trim().toLowerCase();
    if (!q) return variables;
    const filtered = variables.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.value.toLowerCase().includes(q)
    );
    return filtered.length > 0 ? filtered : variables;
  }, [autocomplete.isOpen, autocomplete.query, variables]);

  const [executingBracketIdx, setExecutingBracketIdx] = useState<number | null>(null);

  const handleExecuteBracketPromptInTemplate = async (sectionIdx: number) => {
    if (!editingTemplate) return;
    const sec = editingTemplate.sections[sectionIdx];
    if (!sec) return;
    setExecutingBracketIdx(sectionIdx);

    try {
      const json = await aiExecuteBracketPrompt({
        sectionTitle: sec.title,
        sectionContent: sec.content,
        docType: editingTemplate.docType,
        docTitle: editingTemplate.name,
        variables: variables.reduce((acc: any, v) => {
          acc[v.key] = v.value;
          return acc;
        }, {}),
      });

      if (json.success && json.updatedContent) {
        const updated = [...editingTemplate.sections];
        updated[sectionIdx] = { ...sec, content: json.updatedContent };
        setEditingTemplate({ ...editingTemplate, sections: updated });
        triggerNotice(`Perintah AI [...] pada "${sec.title}" berhasil dieksekusi!`);
      } else {
        triggerNotice(`Gagal mengeksekusi AI: ${json.error || 'Respon tidak valid'}`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal: ${err.message}`);
    } finally {
      setExecutingBracketIdx(null);
    }
  };

  const handleInputCheckTrigger = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldId: string,
    sectionIdx?: number
  ) => {
    // Ignore arrow navigation keys so selectedIndex doesn't reset when user presses ArrowDown/ArrowUp
    if ('key' in e && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) {
      return;
    }

    const target = e.currentTarget;
    const value = target.value;
    const cursor = target.selectionStart || 0;
    const textBefore = value.slice(0, cursor);
    const textAfter = value.slice(cursor);

    let query = '';
    let matchLen = 0;
    let isMatch = false;

    // 1. Direct match: typing {{ or {{variable
    const matchEndsWith = textBefore.match(/\{\{([a-zA-Z0-9_\s]*)$/);
    if (matchEndsWith) {
      query = matchEndsWith[1].trim().toLowerCase();
      matchLen = matchEndsWith[0].length + (textAfter.startsWith('}}') ? 2 : 0);
      isMatch = true;
    } else if (textBefore.endsWith('{{}}')) {
      query = '';
      matchLen = 4;
      isMatch = true;
    } else {
      const lastOpen = textBefore.lastIndexOf('{{');
      if (lastOpen !== -1 && (cursor - lastOpen) <= 35) {
        const slice = textBefore.slice(lastOpen + 2);
        if (slice === '}}' || slice === '}') {
          query = '';
          matchLen = slice.length + 2;
          isMatch = true;
        } else if (!slice.includes('}}')) {
          query = slice.trim().toLowerCase();
          matchLen = slice.length + 2 + (textAfter.startsWith('}}') ? 2 : 0);
          isMatch = true;
        }
      }
    }

    if (isMatch) {
      const rect = target.getBoundingClientRect();
      setAutocomplete((prev) => ({
        isOpen: true,
        query,
        fieldId,
        sectionIdx,
        cursorIndex: Math.max(0, cursor - matchLen),
        position: { top: rect.bottom, left: Math.max(16, rect.left) },
        selectedIndex: prev.query === query && prev.isOpen ? prev.selectedIndex : 0,
      }));
    } else {
      if (autocomplete.isOpen) {
        setAutocomplete((prev) => ({ ...prev, isOpen: false }));
      }
    }
  };

  const insertVariableTag = (key: string, explicitField?: string, explicitSecIdx?: number) => {
    const tag = `{{${key}}}`;
    const fieldId = explicitField || autocomplete.fieldId;
    const sectionIdx = explicitSecIdx !== undefined ? explicitSecIdx : autocomplete.sectionIdx;
    const cursorIndex = autocomplete.cursorIndex;

    if (!editingTemplate) return;

    if (fieldId === 'name') {
      const text = editingTemplate.name;
      const before = text.slice(0, cursorIndex);
      const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*(\}\})?/, '');
      setEditingTemplate({ ...editingTemplate, name: before + tag + after });
    } else if (fieldId === 'description') {
      const text = editingTemplate.description;
      const before = text.slice(0, cursorIndex);
      const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*(\}\})?/, '');
      setEditingTemplate({ ...editingTemplate, description: before + tag + after });
    } else if (fieldId.startsWith('sec_title_') && typeof sectionIdx === 'number') {
      const updated = [...editingTemplate.sections];
      if (updated[sectionIdx]) {
        const text = updated[sectionIdx].title;
        const before = text.slice(0, cursorIndex);
        const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*(\}\})?/, '');
        updated[sectionIdx] = { ...updated[sectionIdx], title: before + tag + after };
        setEditingTemplate({ ...editingTemplate, sections: updated });
      }
    } else if (fieldId.startsWith('sec_content_') && typeof sectionIdx === 'number') {
      const updated = [...editingTemplate.sections];
      if (updated[sectionIdx]) {
        const text = updated[sectionIdx].content;
        const before = text.slice(0, cursorIndex);
        const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*(\}\})?/, '');
        updated[sectionIdx] = { ...updated[sectionIdx], content: before + tag + after };
        setEditingTemplate({ ...editingTemplate, sections: updated });
      }
    } else if (docxEditorRef.current && docxDisplayMode === 'original_docx') {
      docxEditorRef.current.focus();
      document.execCommand('insertText', false, tag);
      const newHtml = docxEditorRef.current.innerHTML;
      setEditingTemplate({ ...editingTemplate, originalDocxHtml: newHtml });
    }

    setAutocomplete((prev) => ({ ...prev, isOpen: false }));
    triggerNotice(`Variabel ${tag} disisipkan!`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!autocomplete.isOpen || matchingAutocompleteVariables.length === 0) {
      if (e.key === 'Escape' && autocomplete.isOpen) {
        setAutocomplete((prev) => ({ ...prev, isOpen: false }));
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocomplete((prev) => ({
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % matchingAutocompleteVariables.length,
      }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocomplete((prev) => ({
        ...prev,
        selectedIndex: (prev.selectedIndex - 1 + matchingAutocompleteVariables.length) % matchingAutocompleteVariables.length,
      }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = matchingAutocompleteVariables[autocomplete.selectedIndex];
      if (selected) {
        insertVariableTag(selected.key);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocomplete((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Insert image directly into editor content with draggable=true
  const handleInsertImageToEditor = (imgDataUrl: string, imgAlt: string = 'Gambar Dokumen') => {
    const imgHtml = `<img src="${imgDataUrl}" alt="${imgAlt}" draggable="true" style="width: 280px; max-width: 100%; height: auto; object-fit: contain; display: block; margin: 12px auto; cursor: move; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.12);" />`;

    if (docxEditorRef.current && docxDisplayMode === 'original_docx') {
      docxEditorRef.current.focus();
      document.execCommand('insertHTML', false, imgHtml);
      const newHtml = docxEditorRef.current.innerHTML;
      setEditingTemplate((prev) => prev ? { ...prev, originalDocxHtml: newHtml } : null);
      triggerNotice('Gambar disisipkan (Klik gambar untuk resize & atur letak, atau tarik untuk pindahkan)');
    } else if (editingTemplate) {
      const updated = [...editingTemplate.sections];
      if (updated.length > 0) {
        updated[0].content += `\n[Gambar: ${imgAlt}]`;
        setEditingTemplate({ ...editingTemplate, sections: updated });
      }
      triggerNotice('Gambar dicatat ke seksi dokumen!');
    }
  };

  // Set multi-column layout
  const handleSetColumns = (cols: number) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, columnCount: cols });
    if (docxEditorRef.current) {
      if (cols === 2) {
        docxEditorRef.current.style.columnCount = '2';
        docxEditorRef.current.style.columnGap = '2rem';
        docxEditorRef.current.style.columnRule = '1px dashed #cbd5e1';
      } else if (cols === 3) {
        docxEditorRef.current.style.columnCount = '3';
        docxEditorRef.current.style.columnGap = '1.5rem';
        docxEditorRef.current.style.columnRule = '1px dashed #cbd5e1';
      } else {
        docxEditorRef.current.style.columnCount = '1';
        docxEditorRef.current.style.columnGap = 'normal';
        docxEditorRef.current.style.columnRule = 'none';
      }
    }
    triggerNotice(`Tata letak diatur menjadi ${cols} kolom.`);
  };

  // Handle direct image upload from user computer to editor
  const handleDirectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        handleInsertImageToEditor(dataUrl, file.name);
        saveMediaItem({
          id: 'med_' + Date.now(),
          name: file.name,
          type: 'image',
          mimeType: file.type,
          size: file.size,
          dataUrl,
          createdAt: new Date().toISOString(),
          category: 'foto',
          description: `Disisipkan pada template ${editingTemplate?.name || 'Dokumen'}`,
        });
        setMediaList(getStoredMedia());
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch =
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.docType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' ||
        (selectedCategory === 'SOP' && tpl.docType === 'SOP') ||
        (selectedCategory === 'SK' && tpl.docType === 'SK') ||
        (selectedCategory === 'KAK' && tpl.docType === 'KAK') ||
        (selectedCategory === 'PEDOMAN' && (tpl.docType === 'PEDOMAN' || tpl.docType === 'PANDUAN')) ||
        (selectedCategory === 'CUSTOM' && (tpl.docType === 'CUSTOM' || !['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'].includes(tpl.docType)));

      return matchSearch && matchCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  // Open Editor for Creating Manual New Template
  const handleStartManualCreate = () => {
    const newTpl: DocumentTemplate = {
      id: 'tpl_' + Date.now(),
      name: 'Template Baru Puskesmas',
      docType: 'SOP',
      category: 'Format Kustom',
      description: 'Format dokumen standar tata naskah akreditasi',
      isBuiltIn: false,
      useKopDefault: true,
      kopMode: 'manual',
      orientation: 'portrait',
      pageCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [
        { id: 'sec_1', title: '1. Pengertian', content: 'Uraian definisi operasional naskah dinas...' },
        { id: 'sec_2', title: '2. Tujuan', content: 'Sebagai acuan penerapan langkah kerja petugas...' },
        { id: 'sec_3', title: '3. Kebijakan', content: 'Surat Keputusan Kepala {{nama_puskesmas}}...' },
        { id: 'sec_4', title: '4. Referensi', content: 'Permenkes No. 43 Tahun 2019 tentang Puskesmas' },
        { id: 'sec_5', title: '5. Prosedur', content: '1. Langkah persiapan...\n2. Langkah pelaksanaan...' },
      ],
    };
    setEditingTemplate(newTpl);
    setDocxDisplayMode('sections');
    setEditorActivePage(1);
    setEditorViewMode('paper_design');
    setIsCreateChoiceModalOpen(false);
    setIsEditorOpen(true);
  };

  // Upload DOCX to Create New Template (PRESERVES EXACT ORIGINAL APPEARANCE)
  const handleUploadDocxCreate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Extract high-fidelity HTML preserving all tables, alignments, bold, headers, and images
      const docxResult = await extractDocxAsHtml(file);
      const rawText = docxResult.rawText;
      const htmlContent = docxResult.html;
      const fileNameWithoutExt = file.name.replace(/\.docx$/i, '');
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      const guessedTitle = lines[0] && lines[0].length < 100 ? lines[0] : fileNameWithoutExt;

      // Guess docType
      let detectedType: DocumentType = 'SOP';
      const upper = rawText.toUpperCase();
      if (upper.includes('SURAT KEPUTUSAN') || upper.includes('MENIMBANG') || upper.includes('MEMUTUSKAN')) {
        detectedType = 'SK';
      } else if (upper.includes('KERANGKA ACUAN') || upper.includes('KAK')) {
        detectedType = 'KAK';
      } else if (upper.includes('PEDOMAN')) {
        detectedType = 'PEDOMAN';
      } else if (upper.includes('PANDUAN')) {
        detectedType = 'PANDUAN';
      }

      // Create fallback section list
      const sections: DocumentSection[] = [
        { id: 'sec_1', title: 'Naskah Asli Lengkap', content: rawText }
      ];

      const newTpl: DocumentTemplate = {
        id: 'tpl_' + Date.now(),
        name: guessedTitle,
        docType: detectedType,
        category: 'Dokumen Word Asli (.docx)',
        description: `Format asli sesuai naskah Word: ${file.name}`,
        isBuiltIn: false,
        useKopDefault: false, // keep authentic header from the docx file itself
        kopMode: 'manual',
        originalDocxHtml: htmlContent, // EXACT AUTHENTIC DOCUMENT APPEARANCE!
        originalDocxBase64: docxResult.base64,
        orientation: 'portrait',
        pageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections,
      };

      setEditingTemplate(newTpl);
      setDocxDisplayMode('original_docx');
      setEditorActivePage(1);
      setEditorViewMode('paper_design');
      setIsCreateChoiceModalOpen(false);
      setIsEditorOpen(true);
      forceBase64Render.current = true;
      setDocxVersion((v) => v + 1); // picu render tampilan asli via effect

      // Save any extracted embedded images to media library
      if (docxResult.embeddedImages && docxResult.embeddedImages.length > 0) {
        let _added = 0;
        docxResult.embeddedImages.forEach((img, idx) => {
          if (mediaExistsByDataUrl(img.dataUrl)) return; // cegah duplikat
          _added++;
          saveMediaItem({
            id: 'med_docx_' + Date.now() + '_' + idx,
            name: `${file.name.replace(/\.docx$/i, '')}_${img.name}`,
            type: 'image',
            mimeType: 'image/png',
            size: Math.round(img.dataUrl.length * 0.75),
            dataUrl: img.dataUrl,
            createdAt: new Date().toISOString(),
            category: 'foto',
            description: `Gambar diekstrak dari berkas Word: ${file.name}`,
          });
        });
        setMediaList(getStoredMedia());
        triggerNotice(`Naskah Word "${file.name}" berhasil dimuat SESUAI ASLINYA!` + (_added > 0 ? ` ${_added} gambar baru disimpan ke Pustaka Media.` : ` Gambar sudah ada di Pustaka Media (tidak diduplikasi).`));
      } else {
        triggerNotice(`Naskah Word "${file.name}" berhasil dimuat SESUAI ASLINYA dan siap diedit langsung!`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal membaca berkas Word: ${err.message}`, 'error');
    }
  };

  // Open DOCX from Media Library to Create New Template (AUTHENTIC APPEARANCE PRESERVED)
  const handleLoadDocxFromMediaItem = async (mediaItem: MediaItem) => {
    try {
      let file: File;
      if (mediaItem.dataUrl && mediaItem.dataUrl.startsWith('data:')) {
        const res = await fetch(mediaItem.dataUrl);
        const blob = await res.blob();
        file = new File([blob], mediaItem.name, { type: mediaItem.mimeType });
      } else {
        file = new File([mediaItem.dataUrl || ''], mediaItem.name, { type: mediaItem.mimeType });
      }

      let docxResult;
      try {
        docxResult = await extractDocxAsHtml(file);
      } catch (parseErr: any) {
        console.warn('extractDocxAsHtml parse warning, using fallback layout:', parseErr);
        docxResult = {
          html: `<div style="font-family: Arial, sans-serif; padding: 24px; line-height: 1.6;"><h2 style="font-size: 18px; font-weight: bold; margin-bottom: 12px; text-align: center;">${mediaItem.name.replace(/\.[^/.]+$/, '')}</h2><p style="margin-bottom: 12px;">${mediaItem.description || 'Naskah naskah dinas akreditasi puskesmas.'}</p><div style="border-top: 1px solid #cbd5e1; margin-top: 24px; padding-top: 12px;"><p><strong>Ditetapkan di:</strong> ${profile.kabupatenKota || 'Puskesmas'}</p></div></div>`,
          rawText: `${mediaItem.name}\n${mediaItem.description || ''}`,
          base64: mediaItem.dataUrl.includes('base64,') ? mediaItem.dataUrl.split('base64,')[1] : undefined,
        };
      }

      const rawText = docxResult.rawText;
      const htmlContent = docxResult.html;
      const fileNameWithoutExt = mediaItem.name.replace(/\.docx$/i, '');
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      const guessedTitle = lines[0] && lines[0].length < 100 ? lines[0] : fileNameWithoutExt;

      let detectedType: DocumentType = 'SOP';
      const upper = rawText.toUpperCase();
      if (upper.includes('SURAT KEPUTUSAN') || upper.includes('MENIMBANG') || upper.includes('MEMUTUSKAN')) {
        detectedType = 'SK';
      } else if (upper.includes('KERANGKA ACUAN') || upper.includes('KAK')) {
        detectedType = 'KAK';
      } else if (upper.includes('PEDOMAN')) {
        detectedType = 'PEDOMAN';
      } else if (upper.includes('PANDUAN')) {
        detectedType = 'PANDUAN';
      }

      const sections: DocumentSection[] = [
        { id: 'sec_1', title: 'Naskah Asli Lengkap', content: rawText }
      ];

      const newTpl: DocumentTemplate = {
        id: 'tpl_' + Date.now(),
        name: guessedTitle,
        docType: detectedType,
        category: 'Dokumen Word Asli (.docx)',
        description: `Format dipanggil dari Pustaka Media: ${mediaItem.name}`,
        isBuiltIn: false,
        useKopDefault: false,
        kopMode: 'manual',
        originalDocxHtml: htmlContent,
        originalDocxBase64: docxResult.base64,
        orientation: 'portrait',
        pageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections,
      };

      setEditingTemplate(newTpl);
      setDocxDisplayMode('original_docx');
      setEditorActivePage(1);
      setEditorViewMode('paper_design');
      setIsCreateChoiceModalOpen(false);
      setIsMediaDocxPickerOpen(false);
      setIsEditorOpen(true);
      forceBase64Render.current = true;
      setDocxVersion((v) => v + 1); // picu render tampilan asli via effect

      if (docxResult.embeddedImages && docxResult.embeddedImages.length > 0) {
        let _added = 0;
        docxResult.embeddedImages.forEach((img, idx) => {
          if (mediaExistsByDataUrl(img.dataUrl)) return; // cegah duplikat
          _added++;
          saveMediaItem({
            id: 'med_docx_' + Date.now() + '_' + idx,
            name: `${mediaItem.name.replace(/\.docx$/i, '')}_${img.name}`,
            type: 'image',
            mimeType: 'image/png',
            size: Math.round(img.dataUrl.length * 0.75),
            dataUrl: img.dataUrl,
            createdAt: new Date().toISOString(),
            category: 'foto',
            description: `Gambar diekstrak dari ${mediaItem.name}`,
          });
        });
        setMediaList(getStoredMedia());
        triggerNotice(`Berkas Word "${mediaItem.name}" berhasil dimuat dari Pustaka Media!` + (_added > 0 ? ` ${_added} gambar baru disimpan.` : ` Gambar sudah ada (tidak diduplikasi).`));
      } else {
        triggerNotice(`Berkas Word "${mediaItem.name}" berhasil dipanggil dari Pustaka Media sesuai tampilan aslinya!`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal membaca berkas Word dari media: ${err.message}`, 'error');
    }
  };

  // Upload DOCX directly to Media Library and simultaneously select as template
  const handleUploadDocxToMediaAndSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const newItem: MediaItem = {
        id: 'med_' + Date.now(),
        name: file.name,
        type: 'document',
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: file.size,
        dataUrl,
        createdAt: new Date().toISOString(),
        category: 'sop',
        description: `Berkas Word diunggah ke Pustaka Media pada ${new Date().toLocaleDateString('id-ID')}`,
      };
      saveMediaItem(newItem);
      setMediaList(getStoredMedia());
      await handleLoadDocxFromMediaItem(newItem);
    };
    reader.readAsDataURL(file);
  };

  // Replace / Re-upload DOCX within active template editor
  const handleReuploadDocxInEditor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTemplate) return;

    try {
      const docxResult = await extractDocxAsHtml(file);
      setEditingTemplate({
        ...editingTemplate,
        originalDocxHtml: docxResult.html,
        originalDocxBase64: docxResult.base64,
        description: `Format asli diperbarui dari: ${file.name}`,
      });
      setDocxDisplayMode('original_docx');
      setDocxVersion((v) => v + 1); // picu render tampilan asli via effect

      if (docxResult.embeddedImages && docxResult.embeddedImages.length > 0) {
        let _added = 0;
        docxResult.embeddedImages.forEach((img, idx) => {
          if (mediaExistsByDataUrl(img.dataUrl)) return; // cegah duplikat
          _added++;
          saveMediaItem({
            id: 'med_docx_' + Date.now() + '_' + idx,
            name: `${file.name.replace(/\.docx$/i, '')}_${img.name}`,
            type: 'image',
            mimeType: 'image/png',
            size: Math.round(img.dataUrl.length * 0.75),
            dataUrl: img.dataUrl,
            createdAt: new Date().toISOString(),
            category: 'foto',
            description: `Gambar diekstrak dari berkas Word: ${file.name}`,
          });
        });
        setMediaList(getStoredMedia());
        triggerNotice(`Naskah diperbarui dari "${file.name}"!` + (_added > 0 ? ` ${_added} gambar baru disimpan ke Pustaka Media.` : ` Gambar sudah ada di Pustaka Media (tidak diduplikasi).`));
      } else {
        triggerNotice(`Naskah diperbarui dari "${file.name}" sesuai format aslinya!`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal membaca berkas Word: ${err.message}`, 'error');
    }
  };

  // Open Editor for Existing Template
  const handleOpenEdit = (tpl: DocumentTemplate) => {
    const clone = JSON.parse(JSON.stringify(tpl));
    if (!clone.orientation) clone.orientation = 'portrait';
    if (!clone.pageCount) clone.pageCount = Math.max(1, Math.ceil(clone.sections.length / 3)) || 2;
    setEditingTemplate(clone);
    setDocxDisplayMode(clone.originalDocxHtml ? 'original_docx' : 'sections');
    setEditorActivePage(1);
    setIsEditorOpen(true);
    if (clone.originalDocxBase64) setDocxVersion((v) => v + 1);
  };

  // Save from Editor
  const handleSaveEditor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim()) {
      triggerNotice('Nama template tidak boleh kosong', 'error');
      return;
    }

    // Capture latest HTML from contentEditable if active
    let templateToSave = { ...editingTemplate };
    if (docxEditorRef.current && docxDisplayMode === 'original_docx') {
      const newHtml = docxEditorRef.current.innerHTML;
      // Jika HTML berubah, berkas Word lama jadi BASI → kosongkan.
      // (Regenerasi .docx dari HTML bersifat lossy untuk tata letak gambar;
      // lebih aman pakai HTML hasil edit sebagai acuan generate & unduh.)
      if (newHtml !== editingTemplate.originalDocxHtml) {
        templateToSave.originalDocxBase64 = undefined;
      }
      templateToSave.originalDocxHtml = newHtml;
    }

    saveDocumentTemplate(templateToSave);
    const updated = getStoredDocumentTemplates();
    setTemplates(updated);
    setIsEditorOpen(false);
    triggerNotice(`Template "${templateToSave.name}" berhasil disimpan!`);
  };

  // Delete Template
  const handleDeleteTemplate = (id: string, name: string) => {
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus template "${name}"?`);
    if (!confirmed) return;

    deleteDocumentTemplate(id);
    const updated = getStoredDocumentTemplates();
    setTemplates(updated);
    triggerNotice(`Template "${name}" berhasil dihapus.`);
  };

  // Reset to Defaults
  const handleResetToDefaults = () => {
    const confirmed = window.confirm('Kosongkan seluruh daftar template? Semua template akan dihapus.');
    if (!confirmed) return;

    resetDocumentTemplates();
    setTemplates(getStoredDocumentTemplates());
    triggerNotice('Pustaka template berhasil direset ke standar Kemenkes.');
  };

  // Export Single Template
  const handleExportSingle = (tpl: DocumentTemplate) => {
    const jsonStr = JSON.stringify(tpl, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${tpl.docType}_${tpl.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotice(`Template "${tpl.name}" berhasil diekspor!`);
  };

  // Export All Templates
  const handleExportAll = () => {
    const jsonStr = JSON.stringify(templates, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pustaka_template_puskesdoc_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotice('Seluruh pustaka template berhasil diekspor ke JSON!');
  };

  // Import Templates from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          let addedCount = 0;
          parsed.forEach((item) => {
            if (item.name && (item.sections || item.originalDocxHtml)) {
              const newTpl: DocumentTemplate = {
                ...item,
                id: item.id || 'tpl_' + Date.now() + Math.random().toString(36).substring(2, 6),
                isBuiltIn: false,
              };
              saveDocumentTemplate(newTpl);
              addedCount++;
            }
          });
          setTemplates(getStoredDocumentTemplates());
          triggerNotice(`${addedCount} template berhasil diimpor ke pustaka!`);
        } else if (parsed.name && (parsed.sections || parsed.originalDocxHtml)) {
          const newTpl: DocumentTemplate = {
            ...parsed,
            id: parsed.id || 'tpl_' + Date.now(),
            isBuiltIn: false,
          };
          saveDocumentTemplate(newTpl);
          setTemplates(getStoredDocumentTemplates());
          triggerNotice(`Template "${newTpl.name}" berhasil diimpor!`);
        } else {
          triggerNotice('Format berkas JSON template tidak valid.', 'error');
        }
      } catch {
        triggerNotice('Gagal membaca berkas JSON template.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Add Section in Editor
  const handleAddSection = (presetTitle?: string, presetContent?: string) => {
    if (!editingTemplate) return;
    const newSec: DocumentSection = {
      id: 'sec_' + Date.now(),
      title: presetTitle || `${editingTemplate.sections.length + 1}. Bagian Baru`,
      content: presetContent || 'Tuliskan isi atau draf bagian ini...',
    };
    setEditingTemplate({
      ...editingTemplate,
      sections: [...editingTemplate.sections, newSec],
    });
    triggerNotice(`Bagian "${newSec.title}" ditambahkan ke template!`);
  };

  // Remove Section in Editor
  const handleRemoveSection = (idx: number) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.filter((_, i) => i !== idx),
    });
  };

  // Update Section in Editor
  const handleUpdateSection = (idx: number, field: 'title' | 'content', value: string) => {
    if (!editingTemplate) return;
    const updated = [...editingTemplate.sections];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditingTemplate({
      ...editingTemplate,
      sections: updated,
    });
  };

  // Drag and drop reordering of sections
  const handleDragStartSection = (idx: number) => {
    setDraggedSectionIdx(idx);
  };

  const handleDropOnSection = (targetIdx: number) => {
    if (!editingTemplate || draggedSectionIdx === null || draggedSectionIdx === targetIdx) return;
    const items = [...editingTemplate.sections];
    const [draggedItem] = items.splice(draggedSectionIdx, 1);
    items.splice(targetIdx, 0, draggedItem);
    setEditingTemplate({
      ...editingTemplate,
      sections: items,
    });
    setDraggedSectionIdx(null);
  };

  // Add a page to the template
  const handleAddPageToTemplate = () => {
    if (!editingTemplate) return;
    const currentCount = editingTemplate.pageCount || 2;
    const newCount = currentCount + 1;
    setEditingTemplate({
      ...editingTemplate,
      pageCount: newCount,
    });
    setEditorActivePage(newCount);
    triggerNotice(`Halaman ${newCount} ditambahkan ke template.`);
  };

  // Rich Text Formatting helper
  const execFormat = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
  };

  // Calculate sections for current page in paper editor
  const templateTotalPages = editingTemplate?.pageCount || 2;
  const sectionsPerPage = Math.max(1, Math.ceil((editingTemplate?.sections.length || 1) / templateTotalPages));
  const currentPageSections = (editingTemplate?.sections || []).slice(
    (editorActivePage - 1) * sectionsPerPage,
    editorActivePage * sectionsPerPage
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Banner & Header */}
      <div className="p-6 rounded-2xl holo-card border border-purple-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Pustaka & Manajer Template Dokumen</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Format Asli & Akreditasi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
            Kelola template SOP, SK, KAK, Pedoman, Panduan, dan format kustom. Buat template secara <strong>manual</strong> atau <strong>upload naskah Word (.docx) dengan tampilan persis aslinya tanpa di-ekstrak</strong>, serta edit langsung di lembar kerja kertas interaktif.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all hover:border-purple-300"
            title="Ekspor seluruh template ke file JSON"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Ekspor Semua</span>
          </button>

          <label
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all hover:border-pink-300 cursor-pointer"
            title="Impor template dari berkas JSON"
          >
            <Upload className="w-3.5 h-3.5 text-pink-600" />
            <span>Impor JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsCreateChoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Template Baru</span>
          </button>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div
          className={`p-3.5 text-xs rounded-xl flex items-center gap-2 shadow-sm animate-fade-in ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Search & Category Filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama template, bab, atau jenis dokumen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center flex-wrap gap-1">
          {['ALL', 'SOP', 'SK', 'KAK', 'PEDOMAN', 'CUSTOM'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'Semua Format' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white rounded-2xl border border-slate-200/90 hover:border-purple-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
          >
            {/* Top Card Header */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {tpl.docType}
                  </span>
                  {tpl.originalDocxHtml && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                      Word Asli
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleExportSingle(tpl)}
                    className="p-1 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50"
                    title="Ekspor template ini ke JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tpl)}
                    className="p-1 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50"
                    title="Edit struktur template"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!tpl.isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Hapus template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-900 transition-colors">
                  {tpl.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {tpl.description}
                </p>
              </div>

              {/* Sections / DOCX Status Peek */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                {tpl.originalDocxHtml ? (
                  <div className="p-2 bg-pink-50/60 rounded-lg border border-pink-100 text-[11px] text-pink-900 flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5 text-pink-600" />
                      Format Naskah Word Asli
                    </span>
                    <span className="text-[10px] font-bold text-pink-700">Tabel & Layout Tersedia</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold">Struktur Bab:</span>
                      <span className="text-purple-600 font-bold">{tpl.sections.length} Bagian</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                      {tpl.sections.map((sec, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md border border-slate-200 truncate max-w-[190px]"
                          title={sec.title}
                        >
                          {sec.title}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {tpl.isBuiltIn ? 'Bawaan Kemenkes' : 'Kustom Anda'}
              </span>

              <button
                type="button"
                onClick={() => onApplyTemplateToGenerator(tpl)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg shadow-sm transition-all active:scale-95"
              >
                <span>Gunakan di Generator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PILIHAN TEMPLATE BARU (MANUAL ATAU UPLOAD DOCX ASLI) */}
      {isCreateChoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Tambah Template Baru</h3>
              </div>
              <button
                onClick={() => setIsCreateChoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pilih cara membuat template dokumen baru Anda:
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* Option 1: Manual */}
              <button
                type="button"
                onClick={handleStartManualCreate}
                className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-left transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-purple-950">Buat Manual</h4>
                  <p className="text-[11px] text-purple-700/80 mt-0.5 leading-relaxed">
                    Isi nama template, tentukan jenis dokumen, dan susun bab/bagian secara bebas di lembar kerja.
                  </p>
                </div>
              </button>

              {/* Option 2: Upload DOCX Sesuai Aslinya */}
              <label className="p-4 rounded-xl border border-pink-200 bg-pink-50/50 hover:bg-pink-100/70 text-left transition-all flex items-start gap-3 group cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 to-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-pink-950">Upload Dokumen Word (.docx) Asli</h4>
                    <span className="text-[9px] px-1.5 py-0.2 bg-pink-200 text-pink-800 rounded font-bold uppercase">Sesuai Aslinya</span>
                  </div>
                  <p className="text-[11px] text-pink-700/80 mt-0.5 leading-relaxed">
                    Tampilan naskah ditampilkan <strong>persis seperti aslinya</strong> (tabel, layout, header, isi) tanpa di-ekstrak atau dipecah, dan siap Anda edit langsung!
                  </p>
                </div>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleUploadDocxCreate}
                  className="hidden"
                />
              </label>

              {/* Option 3: Ambil dari Pustaka Media (.docx) */}
              <button
                type="button"
                onClick={() => {
                  setMediaList(getStoredMedia());
                  setIsCreateChoiceModalOpen(false);
                  setIsMediaDocxPickerOpen(true);
                }}
                className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Folder className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-indigo-950">Ambil dari Pustaka Media (.docx)</h4>
                    <span className="text-[9px] px-1.5 py-0.2 bg-indigo-200 text-indigo-800 rounded font-bold uppercase">Pustaka Media</span>
                  </div>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5 leading-relaxed">
                    Panggil berkas dokumen format Word (.docx) yang sudah tersimpan di Pustaka Media dan buka langsung di editor!
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PILIH DOKUMEN DOCX DARI PUSTAKA MEDIA */}
      {isMediaDocxPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pilih Berkas Word (.docx) dari Pustaka Media
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gunakan berkas format Word yang tersimpan untuk membuat template baru
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaDocxPickerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Media items filter for DOCX / document files */}
              {(() => {
                const docxItems = mediaList.filter(
                  (m) =>
                    m.type === 'document' ||
                    m.name.toLowerCase().endsWith('.docx') ||
                    m.name.toLowerCase().endsWith('.doc') ||
                    (m.mimeType && m.mimeType.includes('word')) ||
                    (m.mimeType && m.mimeType.includes('officedocument'))
                );

                if (docxItems.length === 0) {
                  return (
                    <div className="py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3 bg-slate-50/50">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Belum ada dokumen Word (.docx) di Pustaka Media
                      </h4>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Anda dapat langsung mengunggah berkas .docx ke Pustaka Media sekarang untuk digunakan sebagai template.
                      </p>
                      <div className="pt-2">
                        <input
                          type="file"
                          ref={mediaDocxUploadRef}
                          accept=".docx"
                          onChange={handleUploadDocxToMediaAndSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => mediaDocxUploadRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Berkas .docx ke Media Sekarang</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Ditemukan {docxItems.length} berkas format Word (.docx):
                      </span>
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors">
                        <Plus className="w-3 h-3" />
                        <span>Unggah DOCX Baru</span>
                        <input
                          type="file"
                          accept=".docx"
                          onChange={handleUploadDocxToMediaAndSelect}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {docxItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all flex flex-col justify-between group shadow-2xs"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                                {item.name}
                              </h5>
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                {item.description || 'Berkas dokumen Word pustaka'}
                              </p>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 font-mono mt-1.5">
                                <span>{Math.round(item.size / 1024)} KB</span>
                                <span>·</span>
                                <span>{new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                              {item.category || 'Word'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleLoadDocxFromMediaItem(item)}
                              className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-all active:scale-95"
                            >
                              <span>Pilih Template Ini</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Format Word (.docx) akan ditampilkan persis sesuai tata letak aslinya di editor
              </span>
              <button
                type="button"
                onClick={() => setIsMediaDocxPickerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / CREATE TEMPLATE MODAL WITH INTERACTIVE PAPER DESIGN */}
      {isEditorOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-2xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingTemplate.isBuiltIn ? `Edit Salinan: ${editingTemplate.name}` : `Editor Template: ${editingTemplate.name}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.2 rounded">
                      {editingTemplate.docType}
                    </span>
                    {editingTemplate.originalDocxHtml && (
                      <span className="text-[10px] font-semibold text-pink-700 bg-pink-100 px-2 py-0.2 rounded">
                        Format Naskah Word Asli (Dapat Diedit Langsung)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-2">
                {/* Pilihan Margin Kertas */}
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200" title="Atur margin (batas tepi) kertas editor">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Margin:</span>
                  <select
                    value={tplMarginPreset}
                    onChange={(e) => setTplMarginPreset(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="2,2,2,2">2, 2, 2, 2 cm (Standar)</option>
                    <option value="4,3,3,3">4, 3, 3, 3 cm (Resmi Kemenkes)</option>
                    <option value="1,1,1,1">1, 1, 1, 1 cm (Narrow)</option>
                    <option value="custom">Kustom...</option>
                  </select>
                </div>
                {tplMarginPreset === 'custom' && (
                  <div className="flex items-center gap-1.5 bg-purple-50 px-2 py-1 rounded-xl border border-purple-200 text-[11px]">
                    {(['top', 'left', 'bottom', 'right'] as const).map((k) => (
                      <label key={k} className="flex items-center gap-0.5 font-semibold text-slate-600">
                        {k === 'top' ? 'Atas' : k === 'left' ? 'Kiri' : k === 'bottom' ? 'Bawah' : 'Kanan'}:
                        <input
                          type="number" min="0.5" max="6" step="0.5"
                          value={tplCustomMargin[k]}
                          onChange={(e) => setTplCustomMargin({ ...tplCustomMargin, [k]: parseFloat(e.target.value) || 2 })}
                          className="w-12 px-1 py-0.5 border border-purple-200 rounded bg-white text-center font-bold"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditorViewMode('paper_design')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      editorViewMode === 'paper_design'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Desain Kertas (Preview & Edit)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorViewMode('form')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      editorViewMode === 'form'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editor Form Seksi</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Basic Template Meta Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Nama Template</span>
                    <span className="text-[9px] text-purple-600 font-mono">Ketik {'{{'} untuk variabel</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => {
                      setEditingTemplate({ ...editingTemplate, name: e.target.value });
                      handleInputCheckTrigger(e, 'name');
                    }}
                    onKeyUp={(e) => handleInputCheckTrigger(e, 'name')}
                    onKeyDown={handleInputKeyDown}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jenis Dokumen
                  </label>
                  <select
                    value={editingTemplate.docType}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, docType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="SOP">SOP (Standar Operasional Prosedur)</option>
                    <option value="SK">SK (Surat Keputusan)</option>
                    <option value="KAK">KAK (Kerangka Acuan Kerja)</option>
                    <option value="PEDOMAN">Pedoman Pelayanan</option>
                    <option value="PANDUAN">Panduan Operasional Teknis</option>
                    <option value="CUSTOM">Format Kustom Puskesmas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kategori Template
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.category || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                    list="template-category-suggestions"
                    placeholder="mis. SOP, Dokumen Word Asli..."
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  />
                  <datalist id="template-category-suggestions">
                    <option value="SOP" />
                    <option value="SK" />
                    <option value="KAK" />
                    <option value="Pedoman" />
                    <option value="Panduan" />
                    <option value="Dokumen Word Asli (.docx)" />
                    <option value="Format Kustom" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Deskripsi Ringkas</span>
                    <span className="text-[9px] text-purple-600 font-mono">Ketik {'{{'} untuk variabel</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.description}
                    onChange={(e) => {
                      setEditingTemplate({ ...editingTemplate, description: e.target.value });
                      handleInputCheckTrigger(e, 'description');
                    }}
                    onKeyUp={(e) => handleInputCheckTrigger(e, 'description')}
                    onKeyDown={handleInputKeyDown}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    placeholder="Keterangan fungsi template"
                  />
                </div>
              </div>

              {/* MODE 1: INTERACTIVE PAPER WORKSPACE */}
              {editorViewMode === 'paper_design' ? (
                <div className="space-y-4">
                  {/* Design Toolbar: Orientation, Multi-Page Selector, Format Tools */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    {/* Left: Orientation & Mode Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-600">Orientasi:</span>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setEditingTemplate({ ...editingTemplate, orientation: 'portrait' })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            (editingTemplate.orientation || 'portrait') === 'portrait'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Portrait (Tegak)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTemplate({ ...editingTemplate, orientation: 'landscape' })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            editingTemplate.orientation === 'landscape'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Landscape (Mendatar)
                        </button>
                      </div>

                      {/* If template has originalDocxHtml, allow toggling format display */}
                      {editingTemplate.originalDocxHtml && (
                        <div className="flex items-center gap-1 bg-pink-50 p-1 rounded-lg border border-pink-200 ml-2">
                          <button
                            type="button"
                            onClick={() => setDocxDisplayMode('original_docx')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                              docxDisplayMode === 'original_docx'
                                ? 'bg-pink-600 text-white shadow-2xs'
                                : 'text-pink-700 hover:text-pink-900'
                            }`}
                            title="Tampilkan dokumen dalam format asli naskah Word (.docx) lengkap dengan tabel"
                          >
                            Tampilan Asli Word
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocxDisplayMode('sections')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                              docxDisplayMode === 'sections'
                                ? 'bg-pink-600 text-white shadow-2xs'
                                : 'text-pink-700 hover:text-pink-900'
                            }`}
                            title="Tampilkan dalam kotak-kotak bab seksi terpisah"
                          >
                            Mode Seksi Bab
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Middle: Multi-Page Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 px-1">
                        Halaman:
                      </span>
                      {Array.from({ length: templateTotalPages }, (_, i) => i + 1).map((pNo) => (
                        <button
                          key={pNo}
                          type="button"
                          onClick={() => setEditorActivePage(pNo)}
                          className={`w-7 h-6 text-xs font-semibold rounded-md transition-all flex items-center justify-center ${
                            editorActivePage === pNo
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {pNo}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddPageToTemplate}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                        title="Tambah Halaman Baru ke Template"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Hal Baru</span>
                      </button>
                    </div>

                    {/* Right: Upload/Re-upload DOCX button */}
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer transition-colors">
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Ganti / Upload Berkas Word</span>
                      <input
                        type="file"
                        accept=".docx"
                        onChange={handleReuploadDocxInEditor}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* WYSIWYG Formatting Toolbar for DOCX / Text */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-2 rounded-xl border border-slate-200 text-slate-700">
                    <span className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-wider">
                      Alat Edit Naskah:
                    </span>
                    <button
                      type="button"
                      onClick={() => execFormat('bold')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 font-bold transition-colors"
                      title="Tebal (Bold)"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('italic')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 italic transition-colors"
                      title="Miring (Italic)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('underline')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 underline transition-colors"
                      title="Garis Bawah (Underline)"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowColorPalette((v) => !v)}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors cursor-pointer flex items-center"
                        title="Warna Font — pilih teks dulu lalu pilih warna"
                      >
                        <span className="relative flex items-center">
                          <Type className="w-3.5 h-3.5" />
                          <span className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-sm bg-red-600" />
                        </span>
                      </button>
                      {showColorPalette && (
                        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-slate-300 rounded-xl shadow-xl p-2 grid grid-cols-6 gap-1.5 w-max">
                          {['#000000', '#ff0000', '#0000ff', '#008000', '#ff6600', '#800080', '#666666', '#0066cc', '#009900', '#cc0000', '#ffcc00', '#ffffff'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              title={c}
                              onClick={() => { execFormat('foreColor', c); setShowColorPalette(false); }}
                              className="w-6 h-6 rounded-md border border-slate-400 hover:scale-110 transition-transform cursor-pointer"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="h-4 border-r border-slate-300 mx-1" />

                    <button
                      type="button"
                      onClick={() => execFormat('justifyLeft')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Rata Kiri"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('justifyCenter')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Rata Tengah"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('justifyRight')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Rata Kanan"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('justifyFull')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Rata Kiri Kanan (Justify)"
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>

                    <span className="h-4 border-r border-slate-300 mx-1" />

                    <button
                      type="button"
                      onClick={() => execFormat('insertUnorderedList')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Daftar Butir (Bullets)"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('insertOrderedList')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Daftar Nomor"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>

                    <span className="h-4 border-r border-slate-300 mx-1" />

                    <button
                      type="button"
                      onClick={() => execFormat('undo')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Undo"
                    >
                      <Undo className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => execFormat('redo')}
                      className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 transition-colors"
                      title="Redo"
                    >
                      <Redo className="w-3.5 h-3.5" />
                    </button>

                    <span className="h-4 border-r border-slate-300 mx-1" />

                    {/* Column Layout Selector */}
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <Columns className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-[10px] font-bold text-slate-600">Kolom:</span>
                      <button
                        type="button"
                        onClick={() => handleSetColumns(1)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                          (editingTemplate.columnCount || 1) === 1
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Format 1 Kolom Penuh"
                      >
                        1 Kolom
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetColumns(2)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                          editingTemplate.columnCount === 2
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Format 2 Kolom Seimbang"
                      >
                        2 Kolom
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetColumns(3)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                          editingTemplate.columnCount === 3
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Format 3 Kolom"
                      >
                        3 Kolom
                      </button>
                    </div>

                    <span className="h-4 border-r border-slate-300 mx-1" />

                    {/* Image Insertion Tools */}
                    <div className="flex items-center gap-1">
                      <input
                        type="file"
                        ref={imageUploadRef}
                        accept="image/*"
                        onChange={handleDirectImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageUploadRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white hover:bg-purple-50 text-purple-700 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                        title="Unggah gambar dari komputer dan sisipkan ke naskah"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Sisipkan Gambar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMediaPickerOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors shadow-2xs"
                        title="Pilih gambar dari Pustaka Media yang sudah tersimpan"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        <span>Dari Media</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMediaShelfOpen(!isMediaShelfOpen)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                          isMediaShelfOpen
                            ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Tampilkan baki gambar media cepat untuk drag & drop"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Baki Media</span>
                      </button>

                      <span className="h-4 border-r border-slate-300 mx-1" />

                      {/* Sisipkan Variabel Dropdown Tool */}
                      <button
                        type="button"
                        onClick={() => {
                          const rect = docxEditorRef.current?.getBoundingClientRect() || { bottom: 200, left: 100 };
                          setAutocomplete({
                            isOpen: true,
                            query: '',
                            fieldId: 'docx_editor',
                            cursorIndex: 0,
                            position: { top: rect.bottom, left: Math.max(16, rect.left) },
                            selectedIndex: 0,
                          });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-800 border border-purple-300 rounded-lg transition-colors shadow-2xs"
                        title="Sisipkan tag variabel {{...}} ke dalam naskah"
                      >
                        <Variable className="w-3.5 h-3.5 text-purple-600" />
                        <span>Sisipkan Variabel {'{{...}}'}</span>
                      </button>
                    </div>
                  </div>

                  {/* QUICK MEDIA SHELF (DRAG & DROP READY) */}
                  {isMediaShelfOpen && (
                    <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3 space-y-2 animate-in fade-in duration-200 no-print">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                          Baki Media Siap Pakai (Drag & drop langsung ke kertas di bawah atau klik untuk menyisipkan)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsMediaShelfOpen(false)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        {mediaList.filter(m => m.type === 'image').slice(0, 10).map((media) => (
                          <div
                            key={media.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', media.dataUrl);
                            }}
                            onClick={() => handleInsertImageToEditor(media.dataUrl, media.name)}
                            className="shrink-0 flex items-center gap-2 bg-white hover:bg-purple-100/70 border border-purple-200 hover:border-purple-400 p-1.5 rounded-xl cursor-grab active:cursor-grabbing transition-all shadow-2xs group"
                            title={`Drag atau klik untuk menyisipkan: ${media.name}`}
                          >
                            <img
                              src={media.dataUrl}
                              alt={media.name}
                              className="w-8 h-8 object-contain rounded border border-slate-100 bg-slate-50"
                            />
                            <div className="text-left">
                              <p className="text-[10px] font-bold text-slate-800 truncate max-w-[110px]">
                                {media.name}
                              </p>
                              <span className="text-[9px] text-purple-600 font-medium uppercase">
                                {media.category}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FLOATING IMAGE RESIZE & DRAG-N-DROP CONTROLS */}
                  {selectedImg && (
                    <div className="image-control-bar bg-white/95 backdrop-blur-md border-2 border-purple-500 rounded-2xl shadow-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs z-30 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                          <img src={selectedImg.src} alt="Thumbnail" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs">Atur Gambar Terpilih</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-mono font-bold">
                              {selectedImg.width}px
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Resize ukuran, atur posisi, atau drag & drop ke bagian mana saja
                          </p>
                        </div>
                      </div>

                      {/* Resize Presets & Slider */}
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Ukuran:</span>
                        <button
                          type="button"
                          onClick={() => handleResizeSelectedImg(140)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.width <= 160 ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          Kecil (140px)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResizeSelectedImg(260)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.width > 160 && selectedImg.width <= 320 ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          Sedang (260px)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResizeSelectedImg(420)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.width > 320 && selectedImg.width <= 500 ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          Besar (420px)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResizeSelectedImg(680)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.width > 500 ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          Penuh (100%)
                        </button>
                        <input
                          type="range"
                          min={80}
                          max={720}
                          value={selectedImg.width}
                          onChange={(e) => handleResizeSelectedImg(Number(e.target.value))}
                          className="w-20 accent-purple-600 cursor-pointer"
                          title="Geser untuk atur lebar presisi"
                        />
                      </div>

                      {/* Alignment Options */}
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Posisi:</span>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg('left')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'left' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Rata Kiri"
                        >
                          Kiri
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg('center')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'center' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Tengah"
                        >
                          Tengah
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg('right')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'right' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Rata Kanan"
                        >
                          Kanan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg('float-left')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'float-left' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Float Kiri (Teks membungkus gambar dari kanan)"
                        >
                          Float Kiri
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg('float-right')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'float-right' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Float Kanan (Teks membungkus gambar dari kiri)"
                        >
                          Float Kanan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAlignSelectedImg(selectedImg.align === 'melayang' ? 'left' : 'melayang')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                            selectedImg.align === 'melayang' ? 'bg-purple-600 text-white' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                          title="Melayang: gambar bebas ditaruh di mana saja di atas naskah (tarik dengan mouse). Klik lagi untuk kembali ke alur teks."
                        >
                          {selectedImg.align === 'melayang' ? '✓ Melayang' : 'Melayang'}
                        </button>
                      </div>
                      {selectedImg.align === 'melayang' && (
                        <p className="text-[10px] text-purple-700 font-medium w-full">
                          Mode melayang aktif — tarik gambar dengan mouse untuk menaruh di mana saja di atas naskah.
                        </p>
                      )}

                      {/* Actions: Delete & Close */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDeleteSelectedImg}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                          title="Hapus gambar ini dari naskah"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (docxEditorRef.current) {
                              docxEditorRef.current.querySelectorAll('img[data-img-sel="1"]').forEach((el) => {
                                el.removeAttribute('data-img-sel');
                              });
                            }
                            if (imgBoxRef.current) imgBoxRef.current.style.display = 'none';
                            setSelectedImg(null);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                          title="Tutup panel pengaturan gambar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Banner indicating Authentic DOCX Mode */}
                  {editingTemplate.originalDocxHtml && docxDisplayMode === 'original_docx' && (
                    <div className="p-3 rounded-xl bg-pink-50/80 border border-pink-200 text-xs text-pink-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-pink-600 shrink-0" />
                        <span>
                          <strong>Naskah Word Sesuai Bentuk Aslinya Aktif:</strong> Seluruh tata letak, tabel, dan format naskah dipertahankan. Anda dapat langsung mengklik dan mengedit teks, menyisipkan gambar, atau mengatur kolom.
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-pink-700 shrink-0 font-bold">
                        Siap Diedit Langsung
                      </span>
                    </div>
                  )}

                  {/* Interactive Simulated Paper Sheet (THE EXACT TARGET ELEMENT) */}
                  <div className="bg-slate-200/80 p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-inner flex justify-safe-center overflow-x-auto">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsPaperDragOver(true);
                      }}
                      onDragLeave={() => setIsPaperDragOver(false)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsPaperDragOver(false);

                        // If file dropped from desktop
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const file = e.dataTransfer.files[0];
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              if (dataUrl) {
                                handleInsertImageToEditor(dataUrl, file.name);
                              }
                            };
                            reader.readAsDataURL(file);
                            return;
                          }
                        }

                        // If dragged from media shelf
                        const mediaUrl = e.dataTransfer.getData('text/plain');
                        if (mediaUrl && (mediaUrl.startsWith('data:image') || mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:'))) {
                          handleInsertImageToEditor(mediaUrl, 'Gambar Media');
                        }
                      }}
                      style={{
                        fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                        width: '100%',
                        maxWidth: editingTemplate.orientation === 'landscape' ? '1060px' : '820px',
                        minHeight: editingTemplate.orientation === 'landscape' ? '750px' : '1050px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
                        paddingTop: `${tplActiveMargins.top}cm`,
                        paddingBottom: `${tplActiveMargins.bottom}cm`,
                        paddingLeft: `${tplActiveMargins.left}cm`,
                        paddingRight: `${tplActiveMargins.right}cm`,
                      }}
                      ref={paperWrapRef}
                      className={`bg-white text-slate-900 rounded-sm border transition-all relative flex flex-col justify-between ${
                        isPaperDragOver ? 'ring-4 ring-purple-500 border-purple-500 bg-purple-50/20' : 'border-slate-300'
                      }`}
                    >
                      {/* Overlay seleksi gambar: bingkai + handle resize langsung */}
                      {selectedImg && (
                        <div ref={imgBoxRef} className="absolute z-30 pointer-events-none" style={{ display: 'none' }}>
                          <div className="absolute inset-0 border-2 border-purple-600 rounded-[2px]" />
                          {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => (
                            <div
                              key={pos}
                              onMouseDown={(e) => handleImgResizeStart(e, pos)}
                              className="absolute w-3.5 h-3.5 bg-white border-2 border-purple-600 rounded-full shadow-md pointer-events-auto"
                              style={{
                                left: pos.includes('w') ? '-7px' : undefined,
                                right: pos.includes('e') ? '-7px' : undefined,
                                top: pos.includes('n') ? '-7px' : undefined,
                                bottom: pos.includes('s') ? '-7px' : undefined,
                                cursor: `${pos}-resize`,
                              }}
                              title="Tarik untuk resize gambar"
                            />
                          ))}
                          <div className="absolute -top-7 left-0 whitespace-nowrap text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-md shadow">
                            Tarik sudut untuk resize &bull; Tarik gambar untuk pindah
                          </div>
                        </div>
                      )}
                      <div className="space-y-5">
                        {/* CASE A: ORIGINAL DOCX DISPLAY (SESUAI ASLINYA, DIRECTLY EDITABLE) */}
                        {editingTemplate.originalDocxHtml && docxDisplayMode === 'original_docx' ? (
                          <div className="space-y-4">
                            {/* Running Header */}
                            <div className="border-b border-slate-200 pb-2 text-[11px] text-slate-500 font-mono flex items-center justify-between no-print">
                              <span className="font-bold flex items-center gap-1.5 text-purple-900">
                                <FileCheck className="w-3.5 h-3.5 text-purple-600" />
                                Naskah Asli Word: {editingTemplate.name}
                              </span>
                              <div className="flex items-center gap-2">
                                {editingTemplate.originalDocxBase64 && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (docxEditorRef.current && editingTemplate.originalDocxBase64) {
                                        await renderDocxToContainer(editingTemplate.originalDocxBase64, docxEditorRef.current);
                                        triggerNotice('Naskah Word dimuat ulang persis sesuai dokumen aslinya!');
                                      }
                                    }}
                                    className="text-[10px] text-purple-700 hover:text-purple-900 underline font-semibold"
                                    title="Muat ulang tata letak persis dari berkas DOCX asli"
                                  >
                                    Muat Ulang Tampilan Asli
                                  </button>
                                )}
                                <span className="text-[10px] text-slate-400">
                                  Sesuai Aslinya (Klik untuk Edit Langsung)
                                </span>
                              </div>
                            </div>

                            {/* Direct WYSIWYG Editable Document with exact original appearance */}
                            <div
                              ref={docxEditorRef}
                              contentEditable={true}
                              suppressContentEditableWarning={true}
                              onClick={handleEditorClick}
                              onMouseDown={handleEditorMouseDown}
                              onBlur={(e) => {
                                const newHtml = e.currentTarget.innerHTML;
                                setEditingTemplate((prev) => prev ? { ...prev, originalDocxHtml: newHtml } : null);
                              }}
                              className="docx-document-content min-h-[750px] p-2 leading-relaxed select-text focus:outline-none focus:ring-1 focus:ring-purple-300/40 rounded transition-all cursor-text relative"
                              title="Klik untuk langsung mengedit naskah dokumen sesuai format aslinya (klik gambar untuk resize & atur letak)"
                            />
                          </div>
                        ) : (
                          /* CASE B: SECTION-BASED DRAG & DROP PAPER VIEW */
                          <>
                            {/* Halaman 1: KOP Surat & Header Dokumen */}
                            {editorActivePage === 1 && (
                              <>
                                {/* KOP Surat Preview */}
                                {editingTemplate.useKopDefault && (
                                  <div className="text-center border-b-2 border-slate-900 pb-2">
                                    <div className="flex items-center justify-between gap-3 px-2">
                                      {profile.logoPemda ? (
                                        <img 
                                          src={profile.logoPemda} 
                                          alt="Pemda" 
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          className="w-12 h-12 object-contain" 
                                        />
                                      ) : <div className="w-12 h-12" />}
                                      <div className="flex-1 text-center">
                                        <p className="text-[11px] font-bold text-slate-800 tracking-wider">
                                          {profile.pemerintahDaerah?.toUpperCase()}
                                        </p>
                                        <p className="text-[12px] font-bold text-slate-900 tracking-wider">
                                          {profile.dinasKesehatan?.toUpperCase()}
                                        </p>
                                        <p className="text-[14px] font-black text-slate-950 tracking-wider">
                                          {profile.namaPuskesmas?.toUpperCase()}
                                        </p>
                                        <p className="text-[9px] text-slate-600 italic">
                                          {profile.alamat} · Telp: {profile.telepon}
                                        </p>
                                      </div>
                                      {profile.logoPuskesmas ? (
                                        <img 
                                          src={profile.logoPuskesmas} 
                                          alt="Puskesmas" 
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          className="w-12 h-12 object-contain" 
                                        />
                                      ) : <div className="w-12 h-12" />}
                                    </div>
                                    <div className="border-b-2 border-slate-900 mt-2" />
                                  </div>
                                )}

                                {/* SOP Kotak Akreditasi Preview if SOP */}
                                {editingTemplate.docType === 'SOP' && (
                                  <table className="w-full border-collapse border-2 border-slate-900 text-xs">
                                    <tbody>
                                      <tr>
                                        <td rowSpan={2} className="border-2 border-slate-900 p-2.5 text-center font-bold text-sm w-1/2 align-middle">
                                          {editingTemplate.name.toUpperCase()}
                                        </td>
                                        <td className="border-2 border-slate-900 p-2 text-xs space-y-0.5 w-1/2">
                                          <p><strong>No. Dokumen</strong> : 440/SOP/PKM/2026</p>
                                          <p><strong>No. Revisi</strong>   : 00</p>
                                          <p><strong>SOP</strong></p>
                                          <p><strong>Halaman</strong>      : {`1/${templateTotalPages}`}</p>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="border-2 border-slate-900 p-2 text-xs">
                                          <p className="font-semibold">Ditetapkan Oleh:</p>
                                          <p className="font-bold underline text-xs pt-4">{profile.kepalaPuskesmas}</p>
                                          <p className="text-[10px]">NIP. {profile.nipKepala}</p>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                )}

                                {/* SK or KAK Header */}
                                {editingTemplate.docType !== 'SOP' && (
                                  <div className="text-center space-y-1 border-b border-slate-200 pb-2">
                                    <p className="text-sm font-bold tracking-wide">
                                      {editingTemplate.docType === 'SK' ? `KEPUTUSAN KEPALA ${profile.namaPuskesmas?.toUpperCase()}` : editingTemplate.name.toUpperCase()}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-700">
                                      {editingTemplate.name}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Halaman 2+: Running Header */}
                            {editorActivePage > 1 && (
                              <div className="border-b border-slate-300 pb-2 text-[11px] flex items-center justify-between text-slate-700 font-medium">
                                <span className="font-bold">{editingTemplate.name}</span>
                                <span className="font-mono">Hal {editorActivePage} dari {templateTotalPages}</span>
                              </div>
                            )}

                            {/* Interactive Drag & Drop Sections on this Page */}
                            <div className="space-y-3">
                              {currentPageSections.map((sec, localIdx) => {
                                const globalIdx = (editorActivePage - 1) * sectionsPerPage + localIdx;
                                return (
                                  <div
                                    key={sec.id || globalIdx}
                                    draggable={true}
                                    onDragStart={() => handleDragStartSection(globalIdx)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDropOnSection(globalIdx)}
                                    className={`p-3 bg-white hover:bg-purple-50/30 rounded-xl border border-slate-200 hover:border-purple-300 shadow-2xs space-y-1.5 transition-all group ${
                                      draggedSectionIdx === globalIdx ? 'opacity-50 border-purple-500 border-dashed' : ''
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-1">
                                        <div 
                                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-600 p-0.5 rounded"
                                          title="Tarik untuk memindahkan urutan bagian"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <input
                                          type="text"
                                          value={sec.title}
                                          onChange={(e) => {
                                            handleUpdateSection(globalIdx, 'title', e.target.value);
                                            handleInputCheckTrigger(e, `sec_title_${globalIdx}`, globalIdx);
                                          }}
                                          onKeyUp={(e) => handleInputCheckTrigger(e, `sec_title_${globalIdx}`, globalIdx)}
                                          onKeyDown={handleInputKeyDown}
                                          className="flex-1 px-2 py-0.5 text-xs font-bold border border-transparent hover:border-slate-300 focus:border-purple-500 rounded bg-transparent"
                                          placeholder="Judul Seksi (Ketik {{ untuk variabel)"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSection(globalIdx)}
                                        className="text-slate-300 hover:text-rose-600 p-1 rounded hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Hapus seksi ini"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <textarea
                                      rows={Math.max(2, sec.content.split('\n').length)}
                                      value={sec.content}
                                      onChange={(e) => {
                                        handleUpdateSection(globalIdx, 'content', e.target.value);
                                        handleInputCheckTrigger(e, `sec_content_${globalIdx}`, globalIdx);
                                      }}
                                      onKeyUp={(e) => handleInputCheckTrigger(e, `sec_content_${globalIdx}`, globalIdx)}
                                      onKeyDown={handleInputKeyDown}
                                      className="w-full p-2 text-xs font-sans text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-purple-400 rounded leading-relaxed resize-y font-mono"
                                      placeholder="Isi standar seksi template... (Ketik {{ untuk variabel, gunakan [...] untuk perintah AI)"
                                    />

                                    {/* DETEKTOR & EKSEKUTOR PROMPT AI [...] */}
                                    {sec.content.includes('[') && sec.content.includes(']') && (
                                      <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-fuchsia-50 to-purple-50 border border-purple-200/90 text-xs shadow-2xs">
                                        <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-[11px]">
                                          <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                          <span>Perintah AI [...] terdeteksi dalam tanda kurung siku</span>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={executingBracketIdx === globalIdx}
                                          onClick={() => handleExecuteBracketPromptInTemplate(globalIdx)}
                                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 rounded-lg shadow-2xs transition-all active:scale-95"
                                          title="Eksekusi seluruh perintah prompt AI di dalam tanda kurung siku [...]"
                                        >
                                          {executingBracketIdx === globalIdx ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              <span>Mengeksekusi AI...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-3 h-3" />
                                              <span>⚡ Jalankan Prompt AI [...]</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {currentPageSections.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                                  <p className="text-xs text-slate-500">Belum ada seksi pada Halaman {editorActivePage}.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleAddSection()}
                                    className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg"
                                  >
                                    + Tambah Seksi ke Halaman Ini
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Sign-off preview on last page if not SOP */}
                            {editorActivePage === templateTotalPages && editingTemplate.docType !== 'SOP' && (
                              <div className="pt-6 flex justify-end">
                                <div className="text-right text-xs space-y-0.5 w-60">
                                  <p>Ditetapkan di: {profile.kabupatenKota}</p>
                                  <p className="font-bold pt-2">{profile.jabatanKepala?.toUpperCase()},</p>
                                  <div className="h-12" />
                                  <p className="font-bold underline">{profile.kepalaPuskesmas}</p>
                                  <p className="text-[10px]">NIP. {profile.nipKepala}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Bottom Paper Footer */}
                      <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Format: {editingTemplate.name} ({editingTemplate.orientation || 'Portrait'})</span>
                        <span>Halaman {editorActivePage} dari {templateTotalPages}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* MODE 2: FORM SECTION LIST EDITOR */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Daftar Bagian / Seksi Dokumen</span>
                      <p className="text-[11px] text-slate-500">Edit judul seksi dan isi uraian draf template di bawah ini</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSection()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bagian</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingTemplate.sections.map((sec, idx) => (
                      <div key={sec.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-mono font-bold text-slate-400 w-5">#{idx + 1}</span>
                            <input
                              type="text"
                              value={sec.title}
                              onChange={(e) => {
                                handleUpdateSection(idx, 'title', e.target.value);
                                handleInputCheckTrigger(e, `sec_title_${idx}`, idx);
                              }}
                              onKeyUp={(e) => handleInputCheckTrigger(e, `sec_title_${idx}`, idx)}
                              onKeyDown={handleInputKeyDown}
                              placeholder="Judul Seksi (Ketik {{ untuk variabel)"
                              className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                            title="Hapus bagian ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          value={sec.content}
                          onChange={(e) => {
                            handleUpdateSection(idx, 'content', e.target.value);
                            handleInputCheckTrigger(e, `sec_content_${idx}`, idx);
                          }}
                          onKeyUp={(e) => handleInputCheckTrigger(e, `sec_content_${idx}`, idx)}
                          onKeyDown={handleInputKeyDown}
                          placeholder="Isi uraian standar atau placeholder variabel {{...}} (Gunakan [...] untuk prompt AI)"
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                        />

                        {/* DETEKTOR & EKSEKUTOR PROMPT AI [...] */}
                        {sec.content.includes('[') && sec.content.includes(']') && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-fuchsia-50 to-purple-50 border border-purple-200 text-xs">
                            <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-[11px]">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span>Perintah AI [...] terdeteksi dalam tanda kurung siku</span>
                            </div>
                            <button
                              type="button"
                              disabled={executingBracketIdx === idx}
                              onClick={() => handleExecuteBracketPromptInTemplate(idx)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 rounded-lg shadow-2xs transition-all active:scale-95"
                              title="Eksekusi seluruh perintah prompt AI di dalam tanda kurung siku [...]"
                            >
                              {executingBracketIdx === idx ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Mengeksekusi AI...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  <span>⚡ Jalankan Prompt AI [...]</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {editingTemplate.originalDocxHtml ? 'Naskah Asli Word (.docx)' : `${editingTemplate.sections.length} bagian`} · {templateTotalPages} halaman target
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditor()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-md transition-all active:scale-95"
                >
                  Simpan Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PILIH DARI PUSTAKA MEDIA */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pilih Gambar dari Pustaka Media
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-slate-500">
                Pilih gambar logo, lambang pemda, cap stempel, tanda tangan, atau foto yang sudah tersimpan untuk disisipkan ke naskah template:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaList.filter(m => m.type === 'image').map((media) => (
                  <div
                    key={media.id}
                    onClick={() => {
                      handleInsertImageToEditor(media.dataUrl, media.name);
                      setIsMediaPickerOpen(false);
                    }}
                    className="p-3 bg-slate-50 hover:bg-purple-50/80 border border-slate-200 hover:border-purple-300 rounded-2xl cursor-pointer transition-all flex flex-col items-center text-center group shadow-2xs"
                  >
                    <div className="h-24 w-full flex items-center justify-center p-2 bg-white rounded-xl border border-slate-100 mb-2">
                      <img
                        src={media.dataUrl}
                        alt={media.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 truncate w-full">
                      {media.name}
                    </span>
                    <span className="text-[9px] text-purple-600 font-bold uppercase mt-0.5">
                      {media.category}
                    </span>
                    <button
                      type="button"
                      className="mt-2 w-full py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs transition-colors"
                    >
                      Sisipkan Gambar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING VARIABLE AUTOCOMPLETE POPUP (TRIGGERS ON {{ OR {{}}) */}
      {autocomplete.isOpen && matchingAutocompleteVariables.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.min(window.innerHeight - 340, Math.max(10, autocomplete.position.top + 4))}px`,
            left: `${Math.min(window.innerWidth - 340, Math.max(16, autocomplete.position.left))}px`,
            zIndex: 99999,
          }}
          className="w-80 bg-white rounded-2xl shadow-2xl border-2 border-purple-500 overflow-hidden text-xs animate-in fade-in duration-150 ring-4 ring-purple-500/20 no-print"
        >
          <div className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-700 px-3.5 py-2 text-white flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1.5">
              <Variable className="w-3.5 h-3.5" />
              Pilih Variabel ({matchingAutocompleteVariables.length})
            </span>
            <span className="text-[9px] font-mono opacity-80">↑↓ Pilih · Enter/Klik</span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1 bg-slate-50/50">
            {matchingAutocompleteVariables.map((v, idx) => {
              const isSelected = idx === autocomplete.selectedIndex;
              return (
                <div
                  key={v.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertVariableTag(v.key);
                  }}
                  className={`p-2 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-purple-100 text-purple-900 font-semibold ring-1 ring-purple-300 shadow-2xs'
                      : 'hover:bg-white text-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-purple-700 text-xs font-bold block truncate">
                      {`{{${v.key}}}`}
                    </span>
                    <span className="text-[10px] text-slate-600 block truncate">
                      {v.label}
                    </span>
                    <span className="text-[10px] text-slate-400 italic block truncate">
                      {v.value || '(kosong)'}
                    </span>
                  </div>
                  <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-white text-purple-700 border border-purple-200 uppercase">
                    {v.category}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="px-3 py-1.5 bg-slate-100 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200">
            <span>Ketik manual atau tekan <strong>Esc</strong> untuk tutup</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setAutocomplete((prev) => ({ ...prev, isOpen: false }));
              }}
              className="text-slate-400 hover:text-slate-600 font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
