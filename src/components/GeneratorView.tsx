import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Save, 
  Eye, 
  Plus, 
  Trash2, 
  AlertCircle,
  RefreshCw,
  FileText,
  Upload,
  Image as ImageIcon,
  Sliders,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  FileCheck,
  Variable,
  Database,
  History,
  Clock,
  Square,
  Bot,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { extractTextFromDocx, extractDocxAsHtml } from '../utils/docxReader';
import { 
  DocumentType, 
  IlpKlaster, 
  PuskesDoc, 
  FaskesProfile, 
  VariableItem, 
  CustomDocTypeDefinition,
  DocumentSection,
  DocumentTemplate,
  PuskesmasDatabaseItem,
  CustomAgentConfig
} from '../types';
import { ILP_KLASTERS } from '../utils/constants';
import { 
  substituteVariables, 
  saveDocument, 
  getStoredAgentConfig,
  getStoredAgentList,
  saveAgentList,
  getActiveAgentId,
  setActiveAgentId,
  newAgentId,
  deleteAgentConfig,
  getStoredUserAccount,
  UserAccount,
  getStoredDocumentTemplates, 
  getStoredDatabase,
  getStoredMedia,
  getStoredDocHistory,
  saveDocHistoryItem,
  clearDocHistory,
  DocHistoryItem
} from '../utils/storage';
import { exportToDocx } from '../utils/docxExport';
import { generateStructuredPrompt } from '../utils/promptGenerator';
import { aiGenerateDocument, aiExecuteBracketPrompt } from '../lib/aiAgent';
import { PaperSizeSelector } from './PaperSizeSelector';
import { GeneratedPreviewModal } from './GeneratedPreviewModal';
import { TutorialModal } from './TutorialModal';

interface GeneratorViewProps {
  profile: FaskesProfile;
  variables: VariableItem[];
  customTypes: CustomDocTypeDefinition[];
  currentDoc: PuskesDoc;
  setCurrentDoc: (doc: PuskesDoc) => void;
  onOpenPromptModal: (promptText: string) => void;
  onNavigateToTemplates?: () => void;
  selectedDatabaseItems?: PuskesmasDatabaseItem[];
  setSelectedDatabaseItems?: React.Dispatch<React.SetStateAction<PuskesmasDatabaseItem[]>>;
}

interface GeneratorTabItem {
  id: string;
  title: string;
  doc: PuskesDoc;
  contextInput: string;
  customInstructions: string;
  targetPages: number;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  profile,
  variables,
  customTypes,
  currentDoc,
  setCurrentDoc,
  onOpenPromptModal,
  onNavigateToTemplates,
  selectedDatabaseItems = [],
  setSelectedDatabaseItems,
}) => {
  // Available Puskesmas database items
  const [availableDatabases, setAvailableDatabases] = useState<PuskesmasDatabaseItem[]>(getStoredDatabase());
  const [isDbShelfOpen, setIsDbShelfOpen] = useState(false);

  // Sync available databases on mount
  useEffect(() => {
    setAvailableDatabases(getStoredDatabase());
  }, []);

  // Multiple tabs state for Generator
  const [tabs, setTabs] = useState<GeneratorTabItem[]>([
    {
      id: currentDoc.id || 'tab_1',
      title: currentDoc.title || 'Dokumen 1',
      doc: currentDoc,
      contextInput: '',
      customInstructions: '',
      targetPages: currentDoc.targetPages || 2,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(currentDoc.id || 'tab_1');

  // Preview page selection: DEFAULT to single page 1 with navigation
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number>(1);

  // Paper Size & Margin States
  const [paperSize, setPaperSize] = useState<'A4' | 'F4' | 'Letter'>('A4');
  const [marginPreset, setMarginPreset] = useState<'2,2,2,2' | '4,3,3,3' | 'custom'>('2,2,2,2');
  const [customMargin, setCustomMargin] = useState({ top: 2, left: 2, right: 2, bottom: 2 });

  // AI Agent Selection State (Default: Google Gemini 3.8 Flash via kunci API pribadi)
  // selectedAgentId: 'gemini' atau id custom agent tersimpan (mis. "Maku")
  const [userAccount, setUserAccount] = useState<UserAccount>(getStoredUserAccount());
  const [selectedAgentId, setSelectedAgentId] = useState<string>('gemini');
  const [agentList, setAgentList] = useState<CustomAgentConfig[]>(() => getStoredAgentList());
  const [agentFormMode, setAgentFormMode] = useState<'closed' | 'presets' | 'form'>('closed');

  // Gambar per-section di lembar kerja generator
  const genPaperRef = useRef<HTMLDivElement | null>(null);
  const genImgBoxRef = useRef<HTMLDivElement | null>(null);
  const genImgInputRef = useRef<HTMLInputElement | null>(null);
  const genImgTargetSection = useRef<number>(0);
  const [genSelectedImg, setGenSelectedImg] = useState<{ sectionIdx: number; imageId: string } | null>(null);
  const [agentForm, setAgentForm] = useState({ id: '', name: '', endpoint: '', model: '', apiKey: '', noKey: false });
  const [agentTestStatus, setAgentTestStatus] = useState<string | null>(null);
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  // Tutorial Modal State
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // AI Generation, Progress Bar, & AbortController State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStepText, setProgressStepText] = useState('Menghubungkan ke AI...');
  const abortControllerRef = useRef<AbortController | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [storedTemplates, setStoredTemplates] = useState<DocumentTemplate[]>(getStoredDocumentTemplates());
  const [kopLogoError, setKopLogoError] = useState(false);
  const [executingBracketIdx, setExecutingBracketIdx] = useState<number | null>(null);

  // Popup Preview Modal for AI Generated Document
  const [generatedPreviewDoc, setGeneratedPreviewDoc] = useState<PuskesDoc | null>(null);
  const [isGeneratedPreviewModalOpen, setIsGeneratedPreviewModalOpen] = useState(false);

  // Document History Log Modal
  const [isDocHistoryModalOpen, setIsDocHistoryModalOpen] = useState(false);
  const [docHistoryList, setDocHistoryList] = useState<DocHistoryItem[]>(getStoredDocHistory());

  // Variable autocomplete state when typing {{ or {{}}
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

  const handleInputCheckTrigger = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldId: string,
    sectionIdx?: number
  ) => {
    // CRITICAL: Do NOT reset selectedIndex on Arrow/Enter keys to prevent jump back to top!
    if ('key' in e && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) {
      return;
    }

    const target = e.currentTarget;
    const value = target.value;
    const cursor = target.selectionStart || 0;
    const textBefore = value.slice(0, cursor);

    let query = '';
    let matchLen = 0;
    let isMatch = false;

    // 1. Direct match: typing {{ or {{variable
    const matchEndsWith = textBefore.match(/\{\{([a-zA-Z0-9_\s]*)$/);
    if (matchEndsWith) {
      query = matchEndsWith[1].trim().toLowerCase();
      matchLen = matchEndsWith[0].length;
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
          matchLen = slice.length + 2;
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
        position: {
          top: rect.bottom,
          left: Math.max(16, rect.left),
        },
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

    if (fieldId === 'contextInput') {
      const text = activeTab.contextInput;
      const before = text.slice(0, cursorIndex);
      const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*/, '').replace(/^\}\}/, '');
      updateActiveTab({ contextInput: before + tag + after });
    } else if (fieldId === 'title') {
      const text = activeDoc.title;
      const before = text.slice(0, cursorIndex);
      const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*/, '').replace(/^\}\}/, '');
      updateActiveTab({}, { ...activeDoc, title: before + tag + after });
    } else if (fieldId === 'docNumber') {
      const text = activeDoc.docNumber;
      const before = text.slice(0, cursorIndex);
      const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*/, '').replace(/^\}\}/, '');
      updateActiveTab({}, { ...activeDoc, docNumber: before + tag + after });
    } else if (fieldId.startsWith('section_title_') && typeof sectionIdx === 'number') {
      const sec = activeDoc.sections[sectionIdx];
      if (sec) {
        const text = sec.title;
        const before = text.slice(0, cursorIndex);
        const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*/, '').replace(/^\}\}/, '');
        const updated = [...activeDoc.sections];
        updated[sectionIdx] = { ...sec, title: before + tag + after };
        updateActiveTab({}, { ...activeDoc, sections: updated });
      }
    } else if (fieldId.startsWith('section_') && typeof sectionIdx === 'number') {
      const sec = activeDoc.sections[sectionIdx];
      if (sec) {
        const text = sec.content;
        const before = text.slice(0, cursorIndex);
        const after = text.slice(cursorIndex).replace(/^\{\{[a-zA-Z0-9_\s]*/, '').replace(/^\}\}/, '');
        const updated = [...activeDoc.sections];
        updated[sectionIdx] = { ...sec, content: before + tag + after };
        updateActiveTab({}, { ...activeDoc, sections: updated });
      }
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

  // Active tab derived values
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeDoc = activeTab.doc;

  // Active Klaster with Custom Support
  const activeKlasterInfo = useMemo(() => {
    if (activeDoc.klaster === 'KUSTOM') {
      return {
        id: 'KUSTOM' as IlpKlaster,
        number: '*',
        name: activeDoc.customKlasterName || 'Klaster Kustom / Manual',
        description: 'Klaster yang ditentukan secara khusus oleh Puskesmas',
        examples: [],
      };
    }
    return ILP_KLASTERS.find((k) => k.id === activeDoc.klaster) || ILP_KLASTERS[0];
  }, [activeDoc.klaster, activeDoc.customKlasterName]);

  // Duplicate Title Warning against Media Library & Generation History
  const duplicateTitleWarning = useMemo(() => {
    const currentTitle = (activeDoc.title || '').trim().toLowerCase();
    if (!currentTitle || currentTitle.length < 4) return null;

    // Check History
    const history = docHistoryList;
    const histMatch = history.find((h) => h.title.trim().toLowerCase() === currentTitle);
    if (histMatch) {
      return {
        type: 'history',
        message: `Judul ini pernah digenerate sebelumnya pada ${new Date(histMatch.generatedAt).toLocaleDateString('id-ID')} (${histMatch.docType})`,
        item: histMatch,
      };
    }

    // Check Media
    const media = getStoredMedia();
    const mediaMatch = media.find((m) => 
      m.name.toLowerCase().includes(currentTitle) || 
      (m.description && m.description.toLowerCase().includes(currentTitle))
    );
    if (mediaMatch) {
      return {
        type: 'media',
        message: `Judul ini mirip dengan berkas di Pustaka Media: "${mediaMatch.name}"`,
        item: mediaMatch,
      };
    }

    return null;
  }, [activeDoc.title, docHistoryList]);

  useEffect(() => {
    setStoredTemplates(getStoredDocumentTemplates());
    setUserAccount(getStoredUserAccount());
    const list = getStoredAgentList();
    setAgentList(list);
    const activeId = getActiveAgentId();
    if (activeId && list.some((a) => a.id === activeId)) {
      setSelectedAgentId(activeId);
    }
  }, []);

  const triggerNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  // Active Margins computation (in cm)
  const activeMargins = useMemo(() => {
    if (marginPreset === '2,2,2,2') {
      return { top: 2, left: 2, right: 2, bottom: 2 };
    }
    if (marginPreset === '4,3,3,3') {
      return { top: 4, left: 3, right: 3, bottom: 3 };
    }
    return customMargin;
  }, [marginPreset, customMargin]);

  // Paper Dimensions computation
  const paperDimensions = useMemo(() => {
    switch (paperSize) {
      case 'F4':
        return { maxWidth: '812px', minHeight: '1247px', label: 'F4 / Folio (215 x 330 mm)' };
      case 'Letter':
        return { maxWidth: '816px', minHeight: '1056px', label: 'Letter (216 x 279 mm)' };
      case 'A4':
      default:
        return { maxWidth: '794px', minHeight: '1123px', label: 'A4 (210 x 297 mm)' };
    }
  }, [paperSize]);

  // Pilih agent (Gemini atau salah satu custom agent); pilihan tersimpan sebagai aktif
  const handleSelectAgent = (id: string) => {
    setAgentFormMode('closed');
    setSelectedAgentId(id);
    if (id !== 'gemini') setActiveAgentId(id);
    else setActiveAgentId(null);
  };

  // Buka daftar preset agent (satu klik langsung jadi)
  const handleOpenAddAgent = () => {
    setAgentTestStatus(null);
    setAgentFormMode('presets');
  };

  // Pilih preset: tanpa key -> langsung jadi & aktif; butuh key -> lanjut isi form
  const handlePickPreset = (preset: (typeof AGENT_PRESETS)[number]) => {
    setAgentTestStatus(null);
    if (preset.noKey) {
      const rec: CustomAgentConfig = {
        id: newAgentId(),
        enabled: true,
        name: preset.name,
        noKey: true,
        endpoint: preset.endpoint,
        apiKey: '',
        model: preset.model,
      };
      const next = [...agentList, rec];
      setAgentList(next);
      saveAgentList(next);
      setActiveAgentId(rec.id);
      setSelectedAgentId(rec.id);
      setAgentFormMode('closed');
      triggerNotice(`Agent "${preset.name}" ditambahkan & langsung aktif!`);
      return;
    }
    setAgentForm({ id: '', name: preset.name, endpoint: preset.endpoint, model: preset.model, apiKey: '', noKey: false });
    setAgentFormMode('form');
  };

  // Simpan custom agent (tambah baru / edit yang ada)
  const handleSaveCustomAgent = () => {
    if (!agentForm.name.trim()) {
      triggerNotice('Isi dulu Nama Agent (mis. Maku).');
      return;
    }
    if (!agentForm.endpoint.trim() || (!agentForm.noKey && !agentForm.apiKey.trim())) {
      triggerNotice('Endpoint wajib diisi' + (agentForm.noKey ? '.' : ' beserta API Key.'));
      return;
    }
    const rec: CustomAgentConfig = {
      id: agentForm.id || newAgentId(),
      enabled: true,
      name: agentForm.name.trim(),
      noKey: agentForm.noKey,
      endpoint: agentForm.endpoint.trim(),
      apiKey: agentForm.noKey ? '' : agentForm.apiKey.trim(),
      model: agentForm.model.trim(),
    };
    const next = agentForm.id
      ? agentList.map((a) => (a.id === rec.id ? rec : a))
      : [...agentList, rec];
    setAgentList(next);
    saveAgentList(next);
    setActiveAgentId(rec.id);
    setSelectedAgentId(rec.id);
    setAgentFormMode('closed');
    triggerNotice(`Agent "${rec.name}" berhasil disimpan & aktif!`);
  };

  // Uji koneksi agent langsung dari form (bantu setting sampai jadi)
  const handleTestAgentForm = async () => {
    if (!agentForm.endpoint.trim() || (!agentForm.noKey && !agentForm.apiKey.trim())) {
      setAgentTestStatus('Isi dulu Endpoint' + (agentForm.noKey ? '.' : ' dan API Key.'));
      return;
    }
    setIsTestingAgent(true);
    setAgentTestStatus(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!agentForm.noKey && agentForm.apiKey.trim()) headers['Authorization'] = `Bearer ${agentForm.apiKey.trim()}`;
      const res = await fetch(agentForm.endpoint.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: agentForm.model.trim() || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Balas hanya dengan kata: OK' }],
          temperature: 0.7,
          max_tokens: 10,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const content = data.choices?.[0]?.message?.content || '';
      if (res.ok && content) {
        setAgentTestStatus(`Berhasil terhubung! Respon: "${String(content).slice(0, 60)}" — aman disimpan.`);
      } else {
        setAgentTestStatus(`Gagal (${res.status}): ${data.error?.message || 'endpoint tidak merespon format yang benar.'}`);
      }
    } catch (err: any) {
      setAgentTestStatus(`Koneksi error: ${err.message || err}`);
    } finally {
      setIsTestingAgent(false);
    }
  };

  const handleEditAgent = (a: CustomAgentConfig) => {
    setAgentForm({ id: a.id, name: a.name, endpoint: a.endpoint, model: a.model, apiKey: a.apiKey, noKey: !!a.noKey });
    setAgentTestStatus(null);
    setAgentFormMode('form');
  };

  const handleDeleteAgent = (id: string) => {
    const target = agentList.find((a) => a.id === id);
    if (!target) return;
    if (!window.confirm(`Hapus agent "${target.name}"?`)) return;
    const next = agentList.filter((a) => a.id !== id);
    setAgentList(next);
    deleteAgentConfig(id);
    if (selectedAgentId === id) setSelectedAgentId('gemini');
    triggerNotice(`Agent "${target.name}" dihapus.`);
  };

  const selectedCustomAgent = agentList.find((a) => a.id === selectedAgentId);

  // ============ GAMBAR DI LEMBAR KERJA GENERATOR ============
  const getGenSelectedEl = (): HTMLImageElement | null => {
    if (!genSelectedImg || !genPaperRef.current) return null;
    return genPaperRef.current.querySelector(`img[data-gen-img="${genSelectedImg.imageId}"]`) as HTMLImageElement | null;
  };

  const positionGenImgOverlay = () => {
    const img = getGenSelectedEl();
    const wrap = genPaperRef.current;
    const box = genImgBoxRef.current;
    if (!img || !wrap || !box) return;
    const wr = wrap.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = `${r.left - wr.left}px`;
    box.style.top = `${r.top - wr.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };

  /** Tulis perubahan gambar kembali ke data section */
  const persistGenImage = (sectionIdx: number, imageId: string, updates: Partial<SectionImage>) => {
    const updated = [...activeDoc.sections];
    const sec = { ...updated[sectionIdx] };
    sec.images = (sec.images || []).map((im) => (im.id === imageId ? { ...im, ...updates } : im));
    updated[sectionIdx] = sec;
    updateActiveTab({}, { ...activeDoc, sections: updated });
  };

  const handleGenImageUpload = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const sectionIdx = genImgTargetSection.current;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        triggerNotice('File bukan gambar yang valid.', 'error');
        return;
      }
      const updated = [...activeDoc.sections];
      const sec = { ...updated[sectionIdx] };
      const images = [...(sec.images || [])];
      // cegah duplikat dalam section yang sama
      if (images.some((im) => im.dataUrl === dataUrl)) {
        triggerNotice('Gambar ini sudah ada di bagian tersebut.');
        return;
      }
      images.push({ id: 'gimg_' + Date.now(), dataUrl, width: 280 });
      sec.images = images;
      updated[sectionIdx] = sec;
      updateActiveTab({}, { ...activeDoc, sections: updated });
      triggerNotice('Gambar ditambahkan ke bagian ini — klik gambar untuk resize/pindah.');
    };
    reader.readAsDataURL(files[0]);
  };

  const handleGenImageDelete = (sectionIdx: number, imageId: string) => {
    const updated = [...activeDoc.sections];
    const sec = { ...updated[sectionIdx] };
    sec.images = (sec.images || []).filter((im) => im.id !== imageId);
    updated[sectionIdx] = sec;
    updateActiveTab({}, { ...activeDoc, sections: updated });
    if (genImgBoxRef.current) genImgBoxRef.current.style.display = 'none';
    setGenSelectedImg(null);
  };

  const clearGenImgSelection = () => {
    if (genImgBoxRef.current) genImgBoxRef.current.style.display = 'none';
    setGenSelectedImg(null);
  };

  const handleGenImgClick = (e: React.MouseEvent, sectionIdx: number, imageId: string) => {
    e.stopPropagation();
    setGenSelectedImg({ sectionIdx, imageId });
    requestAnimationFrame(() => positionGenImgOverlay());
  };

  // Tarik badan gambar = otomatis melayang, bebas ditaruh di mana saja di kertas
  const handleGenImgMouseDown = (e: React.MouseEvent, sectionIdx: number, imageId: string) => {
    const target = e.target as HTMLImageElement;
    e.preventDefault();
    e.stopPropagation();
    if (!genPaperRef.current) return;
    setGenSelectedImg({ sectionIdx, imageId });
    let startX = e.clientX;
    let startY = e.clientY;
    let floating = target.dataset.floating === '1';
    let origLeft = parseFloat(target.style.left || '0');
    let origTop = parseFloat(target.style.top || '0');
    let moved = false;
    const ensureFloat = () => {
      const paper = genPaperRef.current!;
      const pr = paper.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      target.dataset.floating = '1';
      target.style.position = 'absolute';
      target.style.left = `${Math.max(0, r.left - pr.left)}px`;
      target.style.top = `${Math.max(0, r.top - pr.top)}px`;
      target.style.margin = '0';
      target.style.zIndex = '20';
      target.style.cursor = 'move';
      floating = true;
      origLeft = parseFloat(target.style.left || '0');
      origTop = parseFloat(target.style.top || '0');
    };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!floating && Math.hypot(dx, dy) < 5) return;
      if (!floating) {
        ensureFloat();
        startX = ev.clientX;
        startY = ev.clientY;
        triggerNotice('Gambar jadi melayang — bebas ditarik ke mana saja di kertas.');
      }
      moved = true;
      target.style.left = `${Math.max(0, origLeft + ev.clientX - startX)}px`;
      target.style.top = `${Math.max(0, origTop + ev.clientY - startY)}px`;
      positionGenImgOverlay();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) {
        persistGenImage(sectionIdx, imageId, {
          floating: true,
          left: parseFloat(target.style.left || '0'),
          top: parseFloat(target.style.top || '0'),
        });
      }
      requestAnimationFrame(() => positionGenImgOverlay());
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize langsung: tarik sudut gambar (proporsional)
  const handleGenImgResizeStart = (e: React.MouseEvent, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    const img = getGenSelectedEl();
    if (!img || !genSelectedImg) return;
    const { sectionIdx, imageId } = genSelectedImg;
    const startX = e.clientX;
    const startW = img.offsetWidth || 200;
    const startH = img.offsetHeight || 150;
    const aspect = startW / Math.max(1, startH);
    const isFloat = img.dataset.floating === '1';
    const startLeft = parseFloat(img.style.left || '0');
    const startTop = parseFloat(img.style.top || '0');
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      let w = startW;
      let l = startLeft;
      let t = startTop;
      if (corner === 'se') w = startW + dx;
      else if (corner === 'sw') { w = startW - dx; l = startLeft + dx; }
      else if (corner === 'ne') { w = startW + dx; t = startTop - (w / aspect - startH); }
      else { w = startW - dx; l = startLeft + dx; t = startTop - (w / aspect - startH); }
      w = Math.max(40, Math.min(1200, w));
      const h = w / aspect;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      if (isFloat) {
        img.style.left = `${Math.max(0, l)}px`;
        img.style.top = `${Math.max(0, t)}px`;
      }
      positionGenImgOverlay();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const updates: Partial<SectionImage> = { width: Math.round(parseFloat(img.style.width || String(startW))) };
      if (isFloat) {
        updates.left = parseFloat(img.style.left || '0');
        updates.top = parseFloat(img.style.top || '0');
      }
      persistGenImage(sectionIdx, imageId, updates);
      requestAnimationFrame(() => positionGenImgOverlay());
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Jaga overlay tetap menempel saat layout berubah / di-scroll
  useEffect(() => {
    if (genSelectedImg) {
      const t = setTimeout(() => positionGenImgOverlay(), 50);
      return () => clearTimeout(t);
    }
  });
  useEffect(() => {
    if (!genSelectedImg) return;
    const onScrollResize = () => positionGenImgOverlay();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [genSelectedImg]);

  // Helper to update active tab state & sync with setCurrentDoc
  const updateActiveTab = (updates: Partial<GeneratorTabItem>, updatedDoc?: PuskesDoc) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) => {
        if (t.id === activeTabId) {
          const newDoc = updatedDoc || (updates.doc ? updates.doc : t.doc);
          const newTitle = newDoc.title || t.title;
          const merged = { ...t, ...updates, doc: newDoc, title: newTitle };
          setCurrentDoc(newDoc);
          return merged;
        }
        return t;
      })
    );
    if (updatedDoc) {
      setCurrentDoc(updatedDoc);
    }
  };

  // Add new blank generator tab
  const handleAddNewTab = () => {
    const newId = 'tab_' + Date.now();
    const newDoc: PuskesDoc = {
      id: newId,
      title: 'Dokumen Standar Akreditasi Puskesmas',
      docType: 'SOP',
      klaster: 'KLASTER_1',
      docNumber: '440/001/SOP/PKM/2026',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useKop: true,
      kopMode: 'manual',
      showPageNumber: true,
      pageNumberPosition: 'bottom-right',
      sections: [
        { id: 'sec_1', title: '1. Pengertian', content: 'Pelayanan di {{nama_puskesmas}}...' },
        { id: 'sec_2', title: '2. Tujuan', content: 'Sebagai acuan penerapan langkah-langkah...' },
        { id: 'sec_3', title: '3. Kebijakan', content: 'SK Kepala Puskesmas...' },
        { id: 'sec_4', title: '4. Referensi', content: 'Kepmenkes Juknis ILP 2023...' },
        { id: 'sec_5', title: '5. Prosedur', content: '1. Petugas menyiapkan...\n2. Petugas melakukan...' },
        { id: 'sec_6', title: '6. Diagram Alir', content: 'Alur kerja...' },
        { id: 'sec_7', title: '7. Unit Terkait', content: 'Klaster Manajemen...' },
        { id: 'sec_8', title: '8. Rekaman Historis Perubahan', content: 'Dokumen Baru Standar ILP' },
      ],
    };

    const newTab: GeneratorTabItem = {
      id: newId,
      title: 'Dokumen Baru',
      doc: newDoc,
      contextInput: '',
      customInstructions: '',
      targetPages: 2,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setSelectedPreviewPage(1);
    setCurrentDoc(newDoc);
  };

  // Close tab
  const handleCloseTab = (tabIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      triggerNotice('Minimal harus ada 1 tab dokumen aktif.');
      return;
    }
    const filtered = tabs.filter((t) => t.id !== tabIdToClose);
    setTabs(filtered);
    if (activeTabId === tabIdToClose) {
      const nextActive = filtered[0];
      setActiveTabId(nextActive.id);
      setSelectedPreviewPage(1);
      setCurrentDoc(nextActive.doc);
    }
  };

  // Handle Type Change
  const handleTypeChange = (newTypeStr: string) => {
    if (newTypeStr.startsWith('tpl:')) {
      const tplId = newTypeStr.replace('tpl:', '');
      const foundTpl = storedTemplates.find((t) => t.id === tplId);
      if (foundTpl) {
        updateActiveTab({}, {
          ...activeDoc,
          title: foundTpl.name,
          docType: (['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'].includes(foundTpl.docType) ? foundTpl.docType : 'CUSTOM') as DocumentType,
          customTypeName: !['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'].includes(foundTpl.docType) ? foundTpl.name : undefined,
          sections: foundTpl.sections.map((s, idx) => ({
            id: s.id || `sec_tpl_${idx}`,
            title: s.title,
            content: s.content,
          })),
          useKop: foundTpl.useKopDefault ?? true,
          kopMode: foundTpl.kopMode || 'manual',
          originalDocxHtml: foundTpl.originalDocxHtml,
          originalDocxBase64: foundTpl.originalDocxBase64,
        });
        triggerNotice(`Template "${foundTpl.name}" berhasil diterapkan!`);
        return;
      }
    }

    const standardTypes = ['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'];
    if (standardTypes.includes(newTypeStr)) {
      updateActiveTab({}, {
        ...activeDoc,
        docType: newTypeStr as DocumentType,
        customTypeName: undefined,
        originalDocxHtml: undefined,
      });
    } else {
      const customDef = customTypes.find((c) => c.id === newTypeStr);
      updateActiveTab({}, {
        ...activeDoc,
        docType: 'CUSTOM',
        customTypeName: customDef ? customDef.name : newTypeStr,
        originalDocxHtml: undefined,
      });
    }
  };

  // Handle Target Pages Change
  const handleTargetPagesChange = (pages: number) => {
    const val = Math.max(1, Math.min(10, pages));
    updateActiveTab({ targetPages: val }, { ...activeDoc, targetPages: val });
    if (selectedPreviewPage > val) {
      setSelectedPreviewPage(val);
    }
  };

  // STOP GENERATE FUNCTION
  const handleStopGenerate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    triggerNotice('Proses generate AI telah dihentikan.');
  };

  // GENERATE VIA AI
  const handleGenerateAI = async () => {
    if (!activeDoc.title.trim()) {
      setErrorMsg('Harap masukkan judul dokumen terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setProgressPercent(10);
    setProgressStepText(
      selectedAgentId === 'gemini'
        ? `Menghubungkan ke Google Gemini 3.8 Flash...`
        : `Menghubungkan ke ${selectedCustomAgent?.name || 'Custom AI'}...`
    );

    abortControllerRef.current = new AbortController();
    const targetP = activeTab.targetPages || 2;

    const progressTimer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 94) return 94;
        const inc = prev < 35 ? 12 : prev < 70 ? 7 : 3;
        const next = prev + inc;
        if (next < 30) setProgressStepText('Menyiapkan prompt naskah & variabel faskes...');
        else if (next < 60) setProgressStepText('Menganalisis regulasi Kemenkes & indikator ILP...');
        else if (next < 85) setProgressStepText(`Menyusun naskah via ${selectedAgentId === 'gemini' ? 'Google Gemini 3.8 Flash' : (selectedCustomAgent?.name || 'Custom AI')}...`);
        else setProgressStepText('Memformat bab, pasal, dan tabel akreditasi...');
        return next;
      });
    }, 550);

    try {
      const activeCustomAgent = selectedAgentId !== 'gemini' ? agentList.find((a) => a.id === selectedAgentId && a.enabled && (a.apiKey || a.noKey)) : undefined;

      const json = await aiGenerateDocument({
        docType: activeDoc.docType === 'CUSTOM' ? (activeDoc.customTypeName || 'Custom') : activeDoc.docType,
        klaster: activeKlasterInfo.name,
        title: activeDoc.title,
        context: activeTab.contextInput,
        customInstructions: activeTab.customInstructions,
        targetPages: targetP,
        selectedDatabaseItems: selectedDatabaseItems,
        variables: variables.reduce((acc: any, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {}),
        customAgentConfig: activeCustomAgent,
        signal: abortControllerRef.current.signal,
      });

      if (json.success && json.data) {
        setProgressPercent(100);
        setProgressStepText('Selesai! Membuka pratinjau...');

        const d = json.data;
        const newSections: DocumentSection[] = (d.sections || []).map((s: any, idx: number) => ({
          id: 'sec_gen_' + idx,
          title: s.title || `Bagian ${idx + 1}`,
          content: s.content || '',
        }));

        const updatedDoc: PuskesDoc = {
          ...activeDoc,
          title: d.title || activeDoc.title,
          docNumber: d.docNumber || activeDoc.docNumber,
          targetPages: targetP,
          sections: newSections.length > 0 ? newSections : activeDoc.sections,
          sopMetadata: d.sopMetadata ? {
            ...d.sopMetadata,
            halaman: `1/${targetP}`,
          } : {
            ...(activeDoc.sopMetadata || {
              noDokumen: activeDoc.docNumber,
              noRevisi: '00',
              tanggalTerbit: new Date().toLocaleDateString('id-ID'),
              unitTerkait: activeKlasterInfo.name,
              penanggungJawab: profile.kepalaPuskesmas,
            }),
            halaman: `1/${targetP}`,
          },
          rawFormattedText: d.rawFormattedText,
        };

        // Record into history
        saveDocHistoryItem({
          id: 'hist_' + Date.now(),
          title: updatedDoc.title,
          docType: updatedDoc.docType,
          klaster: activeKlasterInfo.name,
          generatedAt: new Date().toISOString(),
          targetPages: targetP,
        });
        setDocHistoryList(getStoredDocHistory());

        // Update active tab and open Pop-up Preview modal!
        updateActiveTab({}, updatedDoc);
        setGeneratedPreviewDoc(updatedDoc);
        setIsGeneratedPreviewModalOpen(true);

        triggerNotice(`Dokumen berhasil dibuat via AI! Membuka popup pratinjau...`);
      } else {
        setErrorMsg(json.error || 'Gagal menghasilkan dokumen dari AI');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        triggerNotice('Proses generate telah dihentikan oleh pengguna.');
      } else {
        setErrorMsg(err.message || 'Terjadi gangguan jaringan saat menghubungi AI');
      }
    } finally {
      clearInterval(progressTimer);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Execute bracket prompt [...] on a specific section
  const handleExecuteBracketPrompt = async (globalIdx: number) => {
    const sec = activeDoc.sections[globalIdx];
    if (!sec) return;

    setExecutingBracketIdx(globalIdx);
    const agentConfig = getStoredAgentConfig();

    try {
      const json = await aiExecuteBracketPrompt({
        sectionTitle: sec.title,
        sectionContent: sec.content,
        docType: activeDoc.docType,
        docTitle: activeDoc.title,
        variables: variables.reduce((acc: any, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {}),
        selectedDatabaseItems: selectedDatabaseItems,
        customAgentConfig: agentConfig.enabled ? agentConfig : undefined,
      });

      if (json.success && json.updatedContent) {
        const updated = [...activeDoc.sections];
        updated[globalIdx] = { ...sec, content: json.updatedContent };
        updateActiveTab({}, { ...activeDoc, sections: updated });
        triggerNotice(`Perintah [...] pada "${sec.title}" berhasil dieksekusi via AI!`);
      } else {
        setErrorMsg(json.error || 'Gagal mengeksekusi perintah kurung siku');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi gangguan saat eksekusi prompt kurung siku');
    } finally {
      setExecutingBracketIdx(null);
    }
  };

  const handleOpenPrompt = () => {
    const promptText = generateStructuredPrompt(
      activeDoc.docType,
      activeDoc.klaster,
      activeDoc.title,
      activeTab.contextInput,
      profile,
      variables
    );
    onOpenPromptModal(promptText);
  };

  // Save Document to Local History
  const handleSaveDoc = () => {
    saveDocument(activeDoc);
    saveDocHistoryItem({
      id: 'hist_' + Date.now(),
      title: activeDoc.title,
      docType: activeDoc.docType,
      klaster: activeKlasterInfo.name,
      generatedAt: new Date().toISOString(),
      targetPages: activeTab.targetPages || 2,
    });
    setDocHistoryList(getStoredDocHistory());
    triggerNotice(`Dokumen "${activeDoc.title}" berhasil disimpan ke arsip!`);
  };

  // Download Word .DOCX
  const handleExportWord = async () => {
    try {
      await exportToDocx(activeDoc, profile);
      triggerNotice('Dokumen Word (.docx) berhasil dibuat dan diunduh!');
    } catch (err: any) {
      setErrorMsg(`Gagal mengekspor ke Word: ${err.message}`);
    }
  };

  // ROBUST PRINT FUNCTION (Isolates multi-page A4 document into print frame)
  const handlePrint = () => {
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(generatePrintableDocumentHtml(activeDoc, profile, variables, totalTargetPages));
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch {
            window.print();
          } finally {
            setTimeout(() => {
              if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
              }
            }, 3000);
          }
        }, 400);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  // Export document as JSON
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(activeDoc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.docType}_${activeDoc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotice('Dokumen JSON berhasil diunduh!');
  };

  // Import document from JSON or Word (.docx)
  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.docx')) {
      try {
        const docxRes = await extractDocxAsHtml(file);
        const newCtx = activeTab.contextInput ? `${activeTab.contextInput}\n\n[Draf dari Berkas Word]:\n${docxRes.rawText}` : docxRes.rawText;
        const fileNameTitle = file.name.replace(/\.docx$/i, '');
        updateActiveTab({ contextInput: newCtx }, {
          ...activeDoc,
          title: fileNameTitle,
          originalDocxHtml: docxRes.html,
        });
        triggerNotice(`Naskah Word "${file.name}" berhasil dimuat!`);
      } catch (err: any) {
        setErrorMsg(`Gagal membaca Word: ${err.message}`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.title && parsed.docType) {
            updateActiveTab({}, parsed);
            triggerNotice('Dokumen berhasil dimuat dari file JSON!');
          } else {
            setErrorMsg('Format file JSON dokumen tidak valid.');
          }
        } catch {
          setErrorMsg('Gagal membaca berkas JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSectionContentChange = (idx: number, newContent: string) => {
    const updated = [...activeDoc.sections];
    updated[idx] = { ...updated[idx], content: newContent };
    updateActiveTab({}, { ...activeDoc, sections: updated });
  };

  const toggleDatabaseSelection = (item: PuskesmasDatabaseItem) => {
    if (!setSelectedDatabaseItems) return;
    setSelectedDatabaseItems((prev) => {
      const exists = prev.some((d) => d.id === item.id);
      if (exists) {
        return prev.filter((d) => d.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleSelectAllDatabase = () => {
    if (!setSelectedDatabaseItems) return;
    setSelectedDatabaseItems(availableDatabases);
    triggerNotice(`Seluruh ${availableDatabases.length} data capaian Puskesmas dipilih sebagai bahan AI!`);
  };

  const handleClearAllDatabase = () => {
    if (!setSelectedDatabaseItems) return;
    setSelectedDatabaseItems([]);
    triggerNotice('Pilihan database capaian dikosongkan.');
  };

  const handleInsertDatabaseSummaryToContext = () => {
    if (selectedDatabaseItems.length === 0) return;
    const summaryText = selectedDatabaseItems.map((item, idx) => `
[DATA ${idx + 1}: ${item.title} - ${item.period || 'Terkini'}]
${item.summary}
Indikator:
${(item.metrics || []).map((m) => `* ${m.key}: ${m.value}${m.target ? ` (Target: ${m.target})` : ''} [${m.status || ''}]`).join('\n')}
Catatan: ${item.notes || '-'}
`).join('\n');

    const newContext = activeTab.contextInput
      ? `${activeTab.contextInput}\n\n--- DATA CAPAIAN PUSKESMAS ---\n${summaryText}`
      : `--- DATA CAPAIAN PUSKESMAS ---\n${summaryText}`;

    updateActiveTab({ contextInput: newContext });
    triggerNotice('Ringkasan data capaian berhasil disisipkan ke Catatan Alur / Prompt AI!');
  };

  // Determine pagination split of sections for multi-page rendering
  const totalTargetPages = activeTab.targetPages || 2;
  const sectionsPerPage = Math.max(1, Math.ceil(activeDoc.sections.length / totalTargetPages));

  // Current single page slice to render
  const safeCurrentPage = Math.max(1, Math.min(totalTargetPages, selectedPreviewPage));
  const currentPageSections = activeDoc.sections.slice(
    (safeCurrentPage - 1) * sectionsPerPage,
    safeCurrentPage * sectionsPerPage
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Top Multiple Tabs & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs no-print">
        {/* Generator Tabs List */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 flex-1">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setSelectedPreviewPage(1);
                  setCurrentDoc(tab.doc);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 border ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">{tab.title || `Dokumen ${idx + 1}`}</span>

                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded-md transition-colors"
                    title="Tutup tab ini"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Generator Tab Button */}
          <button
            type="button"
            onClick={handleAddNewTab}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 border-dashed transition-all shrink-0 cursor-pointer"
            title="Buka tab lembar kerja dokumen baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tab</span>
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-200">
          {/* Riwayat Dokumen Button */}
          <button
            onClick={() => {
              setDocHistoryList(getStoredDocHistory());
              setIsDocHistoryModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all hover:border-purple-300 cursor-pointer"
            title="Lihat riwayat dokumen yang pernah di-generate"
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Riwayat ({docHistoryList.length})</span>
          </button>

          <button
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all hover:border-purple-300 cursor-pointer"
            title="Ekspor dokumen aktif ke file Microsoft Word (.docx)"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">.DOCX</span>
          </button>
          <div title="Ukuran kertas untuk ekspor Word (.docx)">
            <PaperSizeSelector compact onNotify={triggerNotice} />
          </div>

          {/* Tombol Cetak (Fixed & Isolated) */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all hover:border-purple-300 cursor-pointer"
            title="Cetak langsung atau simpan sebagai PDF A4 presisi"
          >
            <Printer className="w-3.5 h-3.5 text-pink-600" />
            <span>Cetak</span>
          </button>

          <button
            onClick={handleSaveDoc}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
            title="Simpan dokumen ini ke arsip lokal"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* Banner & Klaster Summary */}
      <div className="p-4 rounded-2xl holo-card border border-purple-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
              {activeDoc.klaster === 'KUSTOM' ? 'Kustom / Manual' : `ILP Klaster ${activeKlasterInfo.number}`}
            </span>
            <h1 className="text-sm font-bold text-slate-900">{activeKlasterInfo.name}</h1>
          </div>
          <p className="text-[11px] text-slate-500 max-w-2xl">{activeKlasterInfo.description}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
            Format: <strong className="text-purple-700">{activeDoc.docType}</strong>
          </span>
          <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
            Target: <strong className="text-purple-700">{totalTargetPages} Halaman</strong>
          </span>
        </div>
      </div>

      {/* Notices */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in shadow-2xs no-print">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in no-print">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL KIRI: Kontrol Form & Parameter AI (5 Kolom) */}
        <div className="lg:col-span-4 space-y-4 no-print">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <FileText className="w-4 h-4 text-purple-600" />
              Pengaturan Dokumen Akreditasi
            </h3>

            {/* Pilihan Jenis Dokumen */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilih Jenis Dokumen
                </label>
                {onNavigateToTemplates && (
                  <button
                    type="button"
                    onClick={onNavigateToTemplates}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 hover:underline transition-all"
                    title="Buka Tab Pustaka Template untuk kelola template"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                    <span>Pustaka Template ({storedTemplates.length})</span>
                  </button>
                )}
              </div>

              <select
                value={activeDoc.docType === 'CUSTOM' ? (activeDoc.customTypeName || 'CUSTOM') : activeDoc.docType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-semibold bg-white cursor-pointer"
              >
                <optgroup label="Standar Akreditasi Kemenkes">
                  <option value="SOP">SOP (Standar Operasional Prosedur - Kotak Akreditasi)</option>
                  <option value="SK">SK (Surat Keputusan Kepala Puskesmas)</option>
                  <option value="KAK">KAK (Kerangka Acuan Kerja 9 Bab)</option>
                  <option value="PEDOMAN">Pedoman Pelayanan Puskesmas</option>
                  <option value="PANDUAN">Panduan Operasional Teknis</option>
                </optgroup>

                {storedTemplates.length > 0 && (
                  <optgroup label={`Pustaka Template Tersimpan (${storedTemplates.length} Template)`}>
                    {storedTemplates.map((t) => (
                      <option key={t.id} value={`tpl:${t.id}`}>
                        [{t.docType}] {t.name} ({t.sections.length} bagian)
                      </option>
                    ))}
                  </optgroup>
                )}

                {customTypes.length > 0 && (
                  <optgroup label="Format Kustom Lainnya">
                    {customTypes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Import & Export Dokumen Bar */}
              <div className="flex items-center gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  title="Ekspor dokumen format JSON"
                >
                  <Download className="w-3 h-3 text-purple-600" />
                  Ekspor JSON
                </button>
                <label
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  title="Impor dokumen dari JSON atau Word .docx"
                >
                  <Upload className="w-3 h-3 text-pink-600" />
                  Impor (.json / .docx)
                  <input
                    type="file"
                    accept=".json,.docx"
                    onChange={handleImportDocument}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Target Jumlah Halaman (Preset buttons deleted, only manual input) */}
            <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200/70">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Jumlah Halaman yang Digenerate
                  </label>
                  <p className="text-[10px] text-slate-500">AI mengatur kepadatan materi & rincian prosedur</p>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={totalTargetPages}
                    onChange={(e) => handleTargetPagesChange(parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-2 py-1 text-xs font-bold text-center border border-purple-300 rounded-lg bg-white text-purple-900 focus:ring-1 focus:ring-purple-500"
                  />
                  <span className="text-xs font-semibold text-purple-900">Hal</span>
                </div>
              </div>
            </div>

            {/* Pilihan Klaster ILP (dengan Kustom / Manual) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Pilih Klaster ILP / Kategori Layanan
              </label>
              <select
                value={activeDoc.klaster}
                onChange={(e) => updateActiveTab({}, { ...activeDoc, klaster: e.target.value as IlpKlaster })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white font-medium cursor-pointer"
              >
                {ILP_KLASTERS.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>

              {/* Input Klaster Kustom / Manual jika KUSTOM dipilih */}
              {activeDoc.klaster === 'KUSTOM' && (
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-purple-900">
                    Nama Klaster Kustom / Manual:
                  </label>
                  <input
                    type="text"
                    value={activeDoc.customKlasterName || ''}
                    onChange={(e) => updateActiveTab({}, { ...activeDoc, customKlasterName: e.target.value })}
                    placeholder="Contoh: Klaster 6: UKS & Remaja, Tim Mutu & Audit, dll"
                    className="w-full px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg bg-white font-semibold text-purple-950 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Gunakan KOP Surat Resmi (Mode KOP Dropdown) */}
            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-purple-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                    {profile.logoPuskesmas && !kopLogoError ? (
                      <img 
                        src={profile.logoPuskesmas} 
                        alt="Logo Puskesmas" 
                        onError={() => setKopLogoError(true)}
                        className="max-w-full max-h-full object-contain" 
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Gunakan KOP Surat Resmi</span>
                    <p className="text-[10px] text-slate-500">{profile.namaPuskesmas || 'Puskesmas'}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDoc.useKop}
                    onChange={(e) => updateActiveTab({}, { ...activeDoc, useKop: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Mode KOP Dropdown */}
              {activeDoc.useKop && (
                <div className="pt-2 border-t border-purple-100 space-y-1 animate-fade-in">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Mode KOP Surat:
                  </label>
                  <select
                    value={activeDoc.kopMode || profile.kopMode || 'manual'}
                    onChange={(e) => updateActiveTab({}, { ...activeDoc, kopMode: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs border border-purple-200 rounded-lg bg-white font-semibold text-purple-950 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                  >
                    <option value="manual">Mode 1: Teks Baku (2 Logo + Teks Alamat Faskes)</option>
                    <option value="image">Mode 2: Gambar KOP Jadi (Upload Gambar Penuh dari Profil)</option>
                    <option value="drag_editor">Mode 3: Editor KOP Visual (Desain Fleksibel)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Pengaturan Nomor Halaman (Header Footer Pengganti) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Nomor Halaman</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDoc.showPageNumber !== false}
                    onChange={(e) => updateActiveTab({}, { ...activeDoc, showPageNumber: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {activeDoc.showPageNumber !== false && (
                <div className="pt-1.5 border-t border-slate-200 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-600">
                    Posisi Nomor Halaman:
                  </label>
                  <select
                    value={activeDoc.pageNumberPosition || 'bottom-right'}
                    onChange={(e) => updateActiveTab({}, { ...activeDoc, pageNumberPosition: e.target.value as any })}
                    className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white font-medium cursor-pointer"
                  >
                    <option value="bottom-right">Bawah Kanan (Standar)</option>
                    <option value="bottom-center">Bawah Tengah</option>
                    <option value="bottom-left">Bawah Kiri</option>
                    <option value="top-right">Atas Kanan</option>
                    <option value="top-center">Atas Tengah</option>
                  </select>
                </div>
              )}
            </div>

            {/* Judul Dokumen & Duplicate Warning */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Dokumen
                </label>
                <input
                  type="text"
                  value={activeDoc.title}
                  onChange={(e) => {
                    updateActiveTab({}, { ...activeDoc, title: e.target.value });
                    handleInputCheckTrigger(e, 'title');
                  }}
                  onKeyUp={(e) => handleInputCheckTrigger(e, 'title')}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Contoh: Pemeriksaan ANC Terpadu Klaster Ibu dan Anak"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-bold"
                />
              </div>

              {/* NOTIFIKASI KEMBAR JUDUL DENGAN MEDIA ATAU RIWAYAT DOKUMEN */}
              {duplicateTitleWarning && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start justify-between gap-2 animate-in fade-in">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block leading-tight">Peringatan Judul Serupa</span>
                      <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                        {duplicateTitleWarning.message}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDocHistoryList(getStoredDocHistory());
                      setIsDocHistoryModalOpen(true);
                    }}
                    className="shrink-0 text-[10px] font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-2 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    Buka Log
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Dokumen / No. SK
                </label>
                <input
                  type="text"
                  value={activeDoc.docNumber}
                  onChange={(e) => {
                    updateActiveTab({}, { ...activeDoc, docNumber: e.target.value });
                    handleInputCheckTrigger(e, 'docNumber');
                  }}
                  onKeyUp={(e) => handleInputCheckTrigger(e, 'docNumber')}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Contoh: 440/012/SOP/PKM.BBK/2026"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Catatan Alur / Konteks Khusus */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Alur Pelayanan / Notulensi Acuan
              </label>
              <textarea
                rows={3}
                value={activeTab.contextInput}
                onChange={(e) => {
                  updateActiveTab({ contextInput: e.target.value });
                  handleInputCheckTrigger(e, 'contextInput');
                }}
                onKeyUp={(e) => handleInputCheckTrigger(e, 'contextInput')}
                onKeyDown={handleInputKeyDown}
                placeholder="Tuliskan catatan alur pelayanan, alur tindakan, petugas pelaksana, atau acuan baku faskes..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            {/* INTEGRASI DATABASE & CAPAIAN PUSKESMAS SEBAGAI BAHAN AI */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-white border border-emerald-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-700" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      Database & Capaian Puskesmas
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Pilih data & metrik capaian sebagai bahan rujukan AI
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedDatabaseItems.length > 0
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {selectedDatabaseItems.length} Dipilih
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDbShelfOpen(!isDbShelfOpen)}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                  >
                    {isDbShelfOpen ? 'Sembunyikan' : 'Pilih Data'}
                  </button>
                </div>
              </div>

              {/* Selected items quick chips */}
              {selectedDatabaseItems.length > 0 && !isDbShelfOpen && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedDatabaseItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                      <span className="truncate max-w-[140px]">{item.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleDatabaseSelection(item)}
                        className="text-emerald-700 hover:text-rose-600 ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded Database Shelf with Checkboxes */}
              {isDbShelfOpen && (
                <div className="space-y-2 pt-1 border-t border-emerald-200/60 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium">
                      Tersedia: {availableDatabases.length} data capaian
                    </span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <button
                        type="button"
                        onClick={handleSelectAllDatabase}
                        className="text-emerald-700 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={handleClearAllDatabase}
                        className="text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-emerald-100/60">
                    {availableDatabases.map((dbItem) => {
                      const isSelected = selectedDatabaseItems.some((d) => d.id === dbItem.id);
                      return (
                        <div
                          key={dbItem.id}
                          onClick={() => toggleDatabaseSelection(dbItem)}
                          className={`p-2 rounded-lg cursor-pointer transition-all flex items-start gap-2 text-xs border ${
                            isSelected
                              ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 font-medium shadow-2xs'
                              : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-emerald-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold truncate text-[11px] block text-slate-900">
                                {dbItem.title}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white text-emerald-800 border border-emerald-200 shrink-0">
                                {dbItem.period || '2026'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {dbItem.summary}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-[9px] text-emerald-700">
                              <span>{(dbItem.metrics || []).length} indikator/metrik</span>
                              <span>·</span>
                              <span className="uppercase font-semibold">{dbItem.category.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action: Paste summary into context */}
              {selectedDatabaseItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleInsertDatabaseSummaryToContext}
                  className="w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/80 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                  title="Sisipkan ringkasan data terpilih ke Catatan Alur / Konteks di atas"
                >
                  <Copy className="w-3 h-3 text-emerald-700" />
                  <span>Sisipkan Ringkasan ke Catatan/Prompt</span>
                </button>
              )}
            </div>

            {/* PILIHAN AI AGENT GENERATOR (Default: Google Gemini Akun Gmail) */}
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-600" />
                  <span>Pilihan AI Agent Generator</span>
                </label>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  {selectedAgentId === 'gemini' ? 'Gemini 3.8 Flash' : (selectedCustomAgent?.name || 'Custom AI')}
                </span>
              </div>

              <div className="flex gap-1.5">
                <select
                  value={selectedAgentId}
                  onChange={(e) => handleSelectAgent(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold border border-purple-300 rounded-lg bg-white text-purple-950 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                >
                  <option value="gemini">
                    Google Gemini 3.8 Flash (API Key Pribadi) [Default]
                  </option>
                  {agentList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.model ? ` — ${a.model}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleOpenAddAgent}
                  className="shrink-0 px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg transition-colors cursor-pointer"
                  title="Tambah AI agent baru (mis. Pollinations, OpenRouter, Groq, Muse)"
                >
                  ＋ Tambah
                </button>
              </div>

              {agentFormMode !== 'closed' ? (
                agentFormMode === 'presets' ? (
                <div className="p-2.5 rounded-lg bg-white border border-purple-200 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-[11px]">Pilih Agent untuk Ditambahkan</span>
                    <button
                      type="button"
                      onClick={() => setAgentFormMode('closed')}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="Tutup"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">Klik <strong>＋ Pakai</strong> — agent langsung ditambahkan & aktif. Tidak perlu isi form.</p>
                  <div className="space-y-1.5">
                    {AGENT_PRESETS.map((preset) => (
                      <div key={preset.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/60">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-slate-800">
                            {preset.name} <span className="font-semibold text-purple-600">• {preset.badge}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 leading-snug">{preset.keyHint}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePickPreset(preset)}
                          className="shrink-0 px-2.5 py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors cursor-pointer"
                        >
                          ＋ Pakai
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                ) : (
                <div className="p-2.5 rounded-lg bg-white border border-purple-200 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-[11px]">
                      {agentForm.id ? 'Edit Agent' : 'Agent Baru'}
                    </span>
                    <span className="text-[10px] text-slate-400">tersimpan khusus di browser ini</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Nama Agent</label>
                    <input
                      type="text"
                      value={agentForm.name}
                      onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                      placeholder="mis. Muse / Pollinations"
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Base URL / Endpoint</label>
                    <input
                      type="text"
                      value={agentForm.endpoint}
                      onChange={(e) => setAgentForm({ ...agentForm, endpoint: e.target.value })}
                      placeholder="https://api.openai.com/v1/chat/completions"
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Model</label>
                      <input
                        type="text"
                        value={agentForm.model}
                        onChange={(e) => setAgentForm({ ...agentForm, model: e.target.value })}
                        placeholder="gpt-4o-mini"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                      />
                    </div>
                    {!agentForm.noKey && (
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">API Key</label>
                        <input
                          type="password"
                          value={agentForm.apiKey}
                          onChange={(e) => setAgentForm({ ...agentForm, apiKey: e.target.value })}
                          placeholder="sk-... / LLM|..."
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                        />
                      </div>
                    )}
                  </div>
                  {agentForm.noKey && (
                    <p className="text-[10px] text-emerald-700 font-semibold">Preset ini tanpa API key — langsung bisa dipakai.</p>
                  )}

                  {agentTestStatus && (
                    <p className={`text-[10px] font-semibold leading-snug p-2 rounded-lg border ${agentTestStatus.startsWith('Berhasil') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                      {agentTestStatus}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAgentFormMode('closed'); setAgentTestStatus(null); }}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleTestAgentForm}
                      disabled={isTestingAgent}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Kirim pesan tes kecil ke agent untuk memastikan endpoint & key benar"
                    >
                      {isTestingAgent ? 'Menguji…' : 'Uji Koneksi'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomAgent}
                      className="flex-1 py-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-lg transition-colors cursor-pointer"
                    >
                      Simpan Agent
                    </button>
                  </div>
                </div>
                )
              ) : selectedAgentId === 'gemini' ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="leading-tight">
                    Agent aktif via <strong>Google Gemini 3.8 Flash</strong> memakai <strong>API key pribadimu</strong> (diatur di Backup & GDrive → tab AI Agent).
                  </span>
                </div>
              ) : selectedCustomAgent ? (
                <div className="p-2.5 rounded-lg bg-white border border-purple-200 space-y-1.5 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> {selectedCustomAgent.name} aktif
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditAgent(selectedCustomAgent)}
                        className="px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAgent(selectedCustomAgent.id)}
                        className="px-2 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate" title={selectedCustomAgent.endpoint}>
                    {selectedCustomAgent.model || '(tanpa nama model)'} • {selectedCustomAgent.endpoint}
                  </p>
                </div>
              ) : null}
            </div>

            {/* AI Generator Action Buttons (with Interactive Progress Bar & Stop Generate) */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isGenerating ? (
                <div className="p-3.5 rounded-xl bg-purple-900 text-white space-y-3 shadow-lg border border-purple-700 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-fuchsia-300 animate-spin" />
                      <span className="text-xs font-bold tracking-wide">
                        Membuat Dokumen via {selectedAgentId === 'gemini' ? 'Gemini 3.8 Flash' : (selectedCustomAgent?.name || 'Custom AI')}...
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-fuchsia-300">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Interactive Progress Bar */}
                  <div className="w-full bg-purple-950/80 rounded-full h-3 overflow-hidden border border-purple-700/60 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${Math.max(5, progressPercent)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-purple-200">
                    <span className="truncate max-w-[200px]">{progressStepText}</span>
                    <span className="text-[10px] text-purple-300 font-mono">Target: {totalTargetPages} Hal</span>
                  </div>

                  {/* Prominent Stop Generate Button */}
                  <button
                    type="button"
                    onClick={handleStopGenerate}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Stop Generate (Hentikan)</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateAI}
                  disabled={!activeDoc.title.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-fuchsia-200" />
                  <span>Generate Otomatis via AI ({totalTargetPages} Halaman)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenPrompt}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Prompt Manual (untuk ChatGPT / Gemini Web)</span>
              </button>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: Lembar Kerja A4 Presisi (Single Page View Default) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Paper View Controls: Ukuran Kertas, Margin, Lihat Hasil, Tutorial, & Navigasi Halaman */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mr-1">
                <Eye className="w-4 h-4 text-purple-600" />
                Lembar Kerja (Hal {safeCurrentPage}/{totalTargetPages})
              </span>

              {/* Tombol Lihat Hasil (Pop-up Preview) */}
              <button
                type="button"
                onClick={() => {
                  setGeneratedPreviewDoc(generatedPreviewDoc || activeDoc);
                  setIsGeneratedPreviewModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Buka kembali Pop-up Preview hasil generate AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-600" />
                <span>Lihat Hasil</span>
              </button>

              {/* Tombol Tutorial Penggunaan PuskesDoc */}
              <button
                type="button"
                onClick={() => setIsTutorialOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer"
                title="Buka panduan lengkap penggunaan PuskesDoc"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                <span>Tutorial Penggunaan</span>
              </button>

              {/* Tombol Cetak Langsung */}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Cetak Naskah Dinas ke Printer / PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Cetak</span>
              </button>
            </div>

            {/* Pengaturan Format Kertas, Margin & Navigasi Halaman */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Pilihan Ukuran Kertas */}
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Kertas:</span>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="A4">A4 (210 x 297 mm)</option>
                  <option value="F4">F4 / Folio (215 x 330 mm)</option>
                  <option value="Letter">Letter (216 x 279 mm)</option>
                </select>
              </div>

              {/* Pilihan Margin */}
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Margin:</span>
                <select
                  value={marginPreset}
                  onChange={(e) => setMarginPreset(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="2,2,2,2">2, 2, 2, 2 cm (Standar)</option>
                  <option value="4,3,3,3">4, 3, 3, 3 cm (Resmi Kemenkes)</option>
                  <option value="custom">Kustom Margin...</option>
                </select>
              </div>

              {/* Page Selection Bar (Clean Page Buttons & Arrows) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 px-1 uppercase tracking-wider">
                  Hal:
                </span>

                {Array.from({ length: totalTargetPages }, (_, i) => i + 1).map((pageNo) => (
                  <button
                    key={pageNo}
                    type="button"
                    onClick={() => setSelectedPreviewPage(pageNo)}
                    className={`w-7 h-6 text-xs font-semibold rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                      safeCurrentPage === pageNo
                        ? 'bg-purple-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={`Buka Halaman ${pageNo}`}
                  >
                    {pageNo}
                  </button>
                ))}

                <div className="flex items-center gap-0.5 pl-1 border-l border-slate-300">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setSelectedPreviewPage((prev) => Math.max(1, prev - 1))}
                    className="p-1 text-slate-600 hover:text-purple-600 disabled:opacity-30 rounded hover:bg-white cursor-pointer"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalTargetPages}
                    onClick={() => setSelectedPreviewPage((prev) => Math.min(totalTargetPages, prev + 1))}
                    className="p-1 text-slate-600 hover:text-purple-600 disabled:opacity-30 rounded hover:bg-white cursor-pointer"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Margin Sub-bar (if custom selected) */}
            {marginPreset === 'custom' && (
              <div className="w-full pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 bg-purple-50/50 p-2 rounded-xl text-xs text-slate-700 animate-in fade-in">
                <span className="font-bold text-purple-900 text-[11px]">Atur Margin Kustom (cm):</span>
                <div className="flex items-center gap-2">
                  <label className="text-[11px]">Atas:</label>
                  <input
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={customMargin.top}
                    onChange={(e) => setCustomMargin({ ...customMargin, top: parseFloat(e.target.value) || 2 })}
                    className="w-14 px-1.5 py-0.5 border border-purple-200 rounded bg-white text-center font-bold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px]">Kiri:</label>
                  <input
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={customMargin.left}
                    onChange={(e) => setCustomMargin({ ...customMargin, left: parseFloat(e.target.value) || 2 })}
                    className="w-14 px-1.5 py-0.5 border border-purple-200 rounded bg-white text-center font-bold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px]">Kanan:</label>
                  <input
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={customMargin.right}
                    onChange={(e) => setCustomMargin({ ...customMargin, right: parseFloat(e.target.value) || 2 })}
                    className="w-14 px-1.5 py-0.5 border border-purple-200 rounded bg-white text-center font-bold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px]">Bawah:</label>
                  <input
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={customMargin.bottom}
                    onChange={(e) => setCustomMargin({ ...customMargin, bottom: parseFloat(e.target.value) || 2 })}
                    className="w-14 px-1.5 py-0.5 border border-purple-200 rounded bg-white text-center font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Real Paper Simulation Container (Always Single Page View) */}
          <input
            type="file"
            ref={genImgInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleGenImageUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="bg-slate-200/80 p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-inner flex flex-col items-center gap-6 overflow-x-auto">
            <div
              ref={genPaperRef}
              style={{
                fontFamily: 'Arial, sans-serif',
                width: paperDimensions.maxWidth,
                minWidth: paperDimensions.maxWidth,
                maxWidth: paperDimensions.maxWidth,
                minHeight: paperDimensions.minHeight,
                paddingTop: `${activeMargins.top}cm`,
                paddingBottom: `${activeMargins.bottom}cm`,
                paddingLeft: `${activeMargins.left}cm`,
                paddingRight: `${activeMargins.right}cm`,
              }}
              className="a4-page bg-white text-slate-900 shadow-xl rounded-sm border border-slate-300 space-y-6 leading-relaxed select-text flex flex-col justify-between relative"
            >
              {/* Overlay seleksi gambar: bingkai + handle resize langsung */}
              {genSelectedImg && (
                <div ref={genImgBoxRef} className="absolute z-30 pointer-events-none no-print" style={{ display: 'none' }}>
                  <div className="absolute inset-0 border-2 border-purple-600 rounded-[2px]" />
                  {(['nw', 'ne', 'sw', 'se'] as const).map((pos) => (
                    <div
                      key={pos}
                      onMouseDown={(e) => handleGenImgResizeStart(e, pos)}
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
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      if (genSelectedImg) handleGenImageDelete(genSelectedImg.sectionIdx, genSelectedImg.imageId);
                    }}
                    className="absolute -top-7 -right-2 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[10px] font-bold shadow pointer-events-auto flex items-center justify-center cursor-pointer"
                    title="Hapus gambar"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="space-y-5">
                {/* Top Page Number if positioned at top */}
                {activeDoc.showPageNumber !== false && (activeDoc.pageNumberPosition === 'top-right' || activeDoc.pageNumberPosition === 'top-center') && (
                  <div className={`text-[10px] text-slate-500 font-mono pb-1 border-b border-slate-100 ${
                    activeDoc.pageNumberPosition === 'top-center' ? 'text-center' : 'text-right'
                  }`}>
                    Halaman {safeCurrentPage} dari {totalTargetPages}
                  </div>
                )}

                {/* If original DOCX HTML is available: Render authentic document appearance directly editable */}
                {activeDoc.originalDocxHtml ? (
                  <div className="space-y-4">
                    <div className="p-2.5 bg-pink-50 border border-pink-200 rounded-xl flex items-center justify-between text-xs text-pink-900 no-print">
                      <span className="font-semibold flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-pink-600" />
                        Format Naskah Word Asli (.docx) — Tampilan Sesuai Aslinya
                      </span>
                      <button
                        type="button"
                        onClick={() => updateActiveTab({}, { ...activeDoc, originalDocxHtml: undefined })}
                        className="text-[10px] text-pink-700 underline font-medium hover:text-pink-900 cursor-pointer"
                      >
                        Beralih ke Format Standar
                      </button>
                    </div>
                    <div
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={(e) => {
                        updateActiveTab({}, { ...activeDoc, originalDocxHtml: e.currentTarget.innerHTML });
                      }}
                      dangerouslySetInnerHTML={{ __html: activeDoc.originalDocxHtml }}
                      className="docx-document-content min-h-[750px] p-2 leading-relaxed select-text focus:outline-none focus:ring-1 focus:ring-purple-300 rounded cursor-text"
                      title="Klik di sini untuk langsung mengedit naskah dokumen sesuai aslinya"
                    />
                  </div>
                ) : (
                  <>
                    {/* Halaman 1: Render KOP & Dokumen Header */}
                    {safeCurrentPage === 1 && (
                      <>
                        {/* 1. KOP SURAT */}
                        {activeDoc.useKop && (
                          (() => {
                            const effectiveKopMode = activeDoc.kopMode || profile.kopMode || 'manual';

                            // Mode 2: Gambar KOP Jadi
                            if (effectiveKopMode === 'image') {
                              if (profile.gambarKopJadi) {
                                return (
                                  <div className="text-center border-b-2 border-slate-900 pb-2 mb-2">
                                    <img
                                      src={profile.gambarKopJadi}
                                      alt="KOP Surat Resmi Jadi"
                                      className="w-full max-h-36 object-contain mx-auto"
                                    />
                                  </div>
                                );
                              }
                            }

                            // Mode 1: Manual Standard Text KOP with 2 Logos
                            return (
                              <div className="border-b-4 border-double border-slate-900 pb-3 mb-4 select-text">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="w-16 h-16 shrink-0 flex items-center justify-center p-0.5">
                                    {profile.logoPemda && (
                                      <img
                                        src={profile.logoPemda}
                                        alt="Logo Pemda"
                                        className="max-h-16 max-w-16 object-contain"
                                      />
                                    )}
                                  </div>
                                  <div className="text-center flex-1 space-y-0.5 leading-tight">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                      {substituteVariables(profile.pemerintahDaerah, variables)}
                                    </h3>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                      {substituteVariables(profile.dinasKesehatan, variables)}
                                    </h2>
                                    <h1 className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-950">
                                      {substituteVariables(profile.namaPuskesmas, variables)}
                                    </h1>
                                    <p className="text-[10px] text-slate-600 font-normal">
                                      {substituteVariables(profile.alamat, variables)}, {profile.kecamatan}, {profile.kabupatenKota}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-mono">
                                      Telp: {profile.telepon || '-'} | Email: {profile.email || '-'}
                                    </p>
                                  </div>
                                  <div className="w-16 h-16 shrink-0 flex items-center justify-center p-0.5">
                                    {profile.logoPuskesmas && (
                                      <img
                                        src={profile.logoPuskesmas}
                                        alt="Logo Puskesmas"
                                        className="max-h-16 max-w-16 object-contain"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* 2. Format SOP Kotak Akreditasi Resmi Kemenkes */}
                        {activeDoc.docType === 'SOP' ? (
                          <div className="border-2 border-slate-900 text-xs mb-4 select-text">
                            <div className="grid grid-cols-12 border-b border-slate-900">
                              <div className="col-span-6 p-3 border-r border-slate-900 flex flex-col justify-center text-center">
                                <h2 className="text-xs font-black uppercase tracking-tight text-slate-900">
                                  {activeDoc.title}
                                </h2>
                                <p className="text-[10px] font-bold text-indigo-950 mt-1">
                                  STANDAR OPERASIONAL PROSEDUR
                                </p>
                              </div>
                              <div className="col-span-6 divide-y divide-slate-900 text-[11px]">
                                <div className="grid grid-cols-12 p-1">
                                  <span className="col-span-5 font-semibold text-slate-700">No. Dokumen</span>
                                  <span className="col-span-7 font-mono font-bold">: {activeDoc.docNumber || '440/SOP/PKM/2026'}</span>
                                </div>
                                <div className="grid grid-cols-12 p-1">
                                  <span className="col-span-5 font-semibold text-slate-700">No. Revisi</span>
                                  <span className="col-span-7 font-mono">: {activeDoc.sopMetadata?.noRevisi || '00'}</span>
                                </div>
                                <div className="grid grid-cols-12 p-1">
                                  <span className="col-span-5 font-semibold text-slate-700">Tanggal Terbit</span>
                                  <span className="col-span-7 font-mono">: {activeDoc.sopMetadata?.tanggalTerbit || new Date().toLocaleDateString('id-ID')}</span>
                                </div>
                                <div className="grid grid-cols-12 p-1">
                                  <span className="col-span-5 font-semibold text-slate-700">Halaman</span>
                                  <span className="col-span-7 font-mono">: {safeCurrentPage}/{totalTargetPages}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-12">
                              <div className="col-span-6 p-2 border-r border-slate-900 flex items-center justify-center font-bold text-center text-slate-900 uppercase">
                                {substituteVariables(profile.namaPuskesmas, variables)}
                              </div>
                              <div className="col-span-6 p-2 text-center text-[11px] leading-tight space-y-1">
                                <p className="text-[10px] text-slate-600">Ditetapkan oleh Penanggung Jawab,</p>
                                <div className="h-4" />
                                <p className="font-bold underline text-slate-900">{profile.kepalaPuskesmas}</p>
                                <p className="text-[10px] font-mono text-slate-600">NIP. {profile.nipKepala}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Document Header for SK, KAK, Pedoman, dll */
                          <div className="text-center space-y-1 pb-4 mb-2">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                              {activeDoc.docType}
                            </h2>
                            <p className="text-base font-extrabold text-slate-950 uppercase leading-snug max-w-lg mx-auto">
                              {activeDoc.title}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {activeKlasterInfo.name} · Tahun {new Date().getFullYear()}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Sections for this specific single page */}
                    <div className="space-y-4 pt-1">
                      {currentPageSections.map((sec, localIdx) => {
                        const globalIdx = (safeCurrentPage - 1) * sectionsPerPage + localIdx;
                        return (
                          <div key={sec.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={sec.title}
                                onChange={(e) => {
                                  const updated = [...activeDoc.sections];
                                  updated[globalIdx] = { ...sec, title: e.target.value };
                                  updateActiveTab({}, { ...activeDoc, sections: updated });
                                  handleInputCheckTrigger(e, `section_title_${globalIdx}`, globalIdx);
                                }}
                                onKeyUp={(e) => handleInputCheckTrigger(e, `section_title_${globalIdx}`, globalIdx)}
                                onKeyDown={handleInputKeyDown}
                                className="text-xs font-bold text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-purple-300 rounded px-1 py-0.5 flex-1"
                                placeholder="Judul Bagian"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setAutocomplete({
                                    isOpen: true,
                                    query: '',
                                    fieldId: `section_${globalIdx}`,
                                    sectionIdx: globalIdx,
                                    cursorIndex: sec.content.length,
                                    position: { top: rect.bottom, left: Math.max(16, rect.left - 150) },
                                    selectedIndex: 0,
                                  });
                                }}
                                className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded transition-all no-print flex items-center gap-1 shrink-0 cursor-pointer"
                                title="Sisipkan variabel ke bagian ini"
                              >
                                <Variable className="w-3 h-3" />
                                <span>{`{{ }}`}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  genImgTargetSection.current = globalIdx;
                                  genImgInputRef.current?.click();
                                }}
                                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-all no-print flex items-center gap-1 shrink-0 cursor-pointer"
                                title="Sisipkan gambar ke bagian ini (klik gambar untuk resize/pindah)"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>Gambar</span>
                              </button>
                            </div>

                            {/* Bracket Prompt [...] Detection & One-Click AI Execution */}
                            {sec.content.includes('[') && sec.content.includes(']') && (
                              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg text-purple-900 text-[11px] font-semibold animate-fade-in no-print">
                                <span className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span className="truncate">Perintah AI <code>[...]</code> terdeteksi di bagian ini</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExecuteBracketPrompt(globalIdx)}
                                  disabled={executingBracketIdx === globalIdx}
                                  className="shrink-0 px-2.5 py-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-md shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  {executingBracketIdx === globalIdx ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Mengeksekusi...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3 h-3 text-pink-300" />
                                      <span>Jalankan Prompt [...] via AI</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            <textarea
                              rows={Math.max(2, sec.content.split('\n').length + 1)}
                              value={sec.content}
                              onFocus={() => setFocusedField(`section_${globalIdx}`)}
                              onBlur={() => setFocusedField(null)}
                              onChange={(e) => {
                                handleSectionContentChange(globalIdx, e.target.value);
                                handleInputCheckTrigger(e, `section_${globalIdx}`, globalIdx);
                              }}
                              onKeyUp={(e) => handleInputCheckTrigger(e, `section_${globalIdx}`, globalIdx)}
                              onKeyDown={handleInputKeyDown}
                              placeholder="Tuliskan isi bagian dokumen atau ketik [perintah untuk AI]..."
                              className="w-full p-2 text-xs font-sans text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-purple-400 rounded focus:outline-none leading-relaxed resize-y transition-colors"
                            />

                            {/* Gambar-gambar bagian ini */}
                            {sec.images && sec.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {sec.images.map((gimg) => (
                                  <div key={gimg.id} className="relative">
                                    <img
                                      data-gen-img={gimg.id}
                                      src={gimg.dataUrl}
                                      alt="Gambar bagian dokumen"
                                      draggable={false}
                                      onClick={(e) => handleGenImgClick(e, globalIdx, gimg.id)}
                                      onMouseDown={(e) => handleGenImgMouseDown(e, globalIdx, gimg.id)}
                                      style={{
                                        width: `${gimg.width || 280}px`,
                                        height: 'auto',
                                        maxWidth: '100%',
                                        cursor: 'move',
                                        borderRadius: '4px',
                                        border: genSelectedImg?.imageId === gimg.id ? '2px solid #9333ea' : '1px solid #e2e8f0',
                                        ...(gimg.floating
                                          ? {
                                              position: 'absolute' as const,
                                              left: `${gimg.left || 0}px`,
                                              top: `${gimg.top || 0}px`,
                                              zIndex: 20,
                                              margin: 0,
                                            }
                                          : {}),
                                      }}
                                      title="Klik untuk memilih • Tarik sudut untuk resize • Tarik untuk pindah"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleGenImageDelete(globalIdx, gimg.id)}
                                      className="no-print absolute -top-2 -right-2 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[10px] font-bold shadow flex items-center justify-center cursor-pointer"
                                      title="Hapus gambar"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sign-off if last page */}
                    {safeCurrentPage === totalTargetPages && activeDoc.docType !== 'SOP' && (
                      <div className="pt-6 flex justify-end">
                        <div className="text-right text-xs space-y-0.5 w-64">
                          <p>Ditetapkan di: {profile.kabupatenKota}</p>
                          <p>Pada tanggal : {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p className="font-bold pt-2">{profile.jabatanKepala?.toUpperCase()},</p>
                          <div className="h-14" />
                          <p className="font-bold underline text-xs">{profile.kepalaPuskesmas}</p>
                          <p className="text-[11px]">NIP. {profile.nipKepala}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom Page Number Position (no generic footer) */}
              {activeDoc.showPageNumber !== false && (activeDoc.pageNumberPosition !== 'top-right' && activeDoc.pageNumberPosition !== 'top-center') && (
                <div className={`text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-100 ${
                  activeDoc.pageNumberPosition === 'bottom-center' ? 'text-center' :
                  activeDoc.pageNumberPosition === 'bottom-left' ? 'text-left' :
                  'text-right'
                }`}>
                  Halaman {safeCurrentPage} dari {totalTargetPages}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING VARIABLE AUTOCOMPLETE POPUP (TRIGGERS ON {{) */}
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
                  ref={(el) => {
                    if (isSelected && el) {
                      el.scrollIntoView({ block: 'nearest' });
                    }
                  }}
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
            <span>Tekan <strong>Esc</strong> untuk tutup</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setAutocomplete((prev) => ({ ...prev, isOpen: false }));
              }}
              className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* POPUP PREVIEW HASIL GENERATE (WITH SAVE TO MEDIA & DOWNLOAD) */}
      <GeneratedPreviewModal
        isOpen={isGeneratedPreviewModalOpen}
        onClose={() => setIsGeneratedPreviewModalOpen(false)}
        generatedDoc={generatedPreviewDoc}
        profile={profile}
        onApplyToEditor={(doc) => {
          updateActiveTab({}, doc);
          setIsGeneratedPreviewModalOpen(false);
        }}
        onNotify={(msg) => triggerNotice(msg)}
      />

      {/* MODAL TUTORIAL PENGGUNAAN */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* MODAL RIWAYAT DOKUMEN GENERATE */}
      {isDocHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-purple-200" />
                <div>
                  <h3 className="font-bold text-base">Riwayat Dokumen yang Pernah Digenerate</h3>
                  <p className="text-xs text-purple-200">Log dokumen hasil generate sebelumnya</p>
                </div>
              </div>
              <button
                onClick={() => setIsDocHistoryModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
              {docHistoryList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Belum ada catatan riwayat dokumen.
                </div>
              ) : (
                docHistoryList.map((hist) => (
                  <div key={hist.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        {hist.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-bold">{hist.docType}</span>
                        <span>{hist.klaster}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(hist.generatedAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        updateActiveTab({}, { ...activeDoc, title: hist.title, docType: hist.docType as any });
                        setIsDocHistoryModalOpen(false);
                        triggerNotice(`Judul "${hist.title}" dimuat ke generator!`);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shrink-0 cursor-pointer"
                    >
                      Gunakan Judul
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Kosongkan riwayat dokumen generate?')) {
                    clearDocHistory();
                    setDocHistoryList([]);
                    triggerNotice('Riwayat berhasil dikosongkan.');
                  }
                }}
                className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
              >
                Hapus Semua Riwayat
              </button>
              <button
                onClick={() => setIsDocHistoryModalOpen(false)}
                className="px-4 py-1.5 font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Generates Printable Multi-Page HTML with exact page numbering and A4 margins
function generatePrintableDocumentHtml(
  doc: PuskesDoc,
  profile: FaskesProfile,
  variables: VariableItem[],
  totalTargetPages: number
): string {
  const sectionsPerPage = Math.max(1, Math.ceil(doc.sections.length / totalTargetPages));
  const showPageNumber = doc.showPageNumber !== false;
  const pageNumberPosition = doc.pageNumberPosition || 'bottom-right';

  const positionStyles: Record<string, string> = {
    'bottom-right': 'position: absolute; bottom: 15mm; right: 20mm;',
    'bottom-center': 'position: absolute; bottom: 15mm; left: 0; right: 0; text-align: center;',
    'bottom-left': 'position: absolute; bottom: 15mm; left: 20mm;',
    'top-right': 'position: absolute; top: 15mm; right: 20mm;',
    'top-center': 'position: absolute; top: 15mm; left: 0; right: 0; text-align: center;',
  };

  const pagesHtml = Array.from({ length: totalTargetPages }, (_, pIdx) => {
    const pageNo = pIdx + 1;
    const pageSections = doc.sections.slice(pIdx * sectionsPerPage, (pIdx + 1) * sectionsPerPage);

    // KOP for page 1
    let kopHtml = '';
    if (pageNo === 1 && doc.useKop) {
      const kopMode = doc.kopMode || profile.kopMode || 'manual';
      if (kopMode === 'image' && profile.gambarKopJadi) {
        kopHtml = `<div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">
          <img src="${profile.gambarKopJadi}" style="max-height: 120px; max-width: 100%;" />
        </div>`;
      } else {
        kopHtml = `<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 16px;">
          <img src="${profile.logoPemda}" style="width: 65px; height: 65px; object-fit: contain;" />
          <div style="text-align: center; flex: 1; padding: 0 10px;">
            <div style="font-size: 11pt; font-weight: bold; letter-spacing: 0.5px;">${profile.pemerintahDaerah.toUpperCase()}</div>
            <div style="font-size: 11pt; font-weight: bold;">${profile.dinasKesehatan.toUpperCase()}</div>
            <div style="font-size: 14pt; font-weight: 900; letter-spacing: 1px;">${profile.namaPuskesmas.toUpperCase()}</div>
            <div style="font-size: 8.5pt;">${profile.alamat}, ${profile.kecamatan}, ${profile.kabupatenKota}</div>
            <div style="font-size: 8.5pt;">Telp: ${profile.telepon || '-'} | Email: ${profile.email || '-'}</div>
          </div>
          <img src="${profile.logoPuskesmas}" style="width: 65px; height: 65px; object-fit: contain;" />
        </div>`;
      }
    }

    // Title / SOP Box for page 1
    let titleHtml = '';
    if (pageNo === 1) {
      if (doc.docType === 'SOP') {
        titleHtml = `<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 2px solid #000; font-size: 9.5pt;">
          <tr>
            <td rowspan="3" style="width: 50%; border: 1.5px solid #000; padding: 8px; text-align: center; vertical-align: middle;">
              <div style="font-size: 12pt; font-weight: bold; margin-bottom: 4px;">${doc.title.toUpperCase()}</div>
              <div style="font-weight: bold; color: #1e1b4b;">STANDAR OPERASIONAL PROSEDUR</div>
            </td>
            <td style="border: 1px solid #000; padding: 4px 8px; width: 25%;">No. Dokumen</td>
            <td style="border: 1px solid #000; padding: 4px 8px;">${doc.docNumber || '440/SOP/PKM/2026'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 4px 8px;">No. Revisi</td>
            <td style="border: 1px solid #000; padding: 4px 8px;">${doc.sopMetadata?.noRevisi || '00'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 4px 8px;">Tgl. Terbit</td>
            <td style="border: 1px solid #000; padding: 4px 8px;">${doc.sopMetadata?.tanggalTerbit || new Date().toLocaleDateString('id-ID')}</td>
          </tr>
          <tr>
            <td style="border: 1.5px solid #000; padding: 6px 8px; text-align: center;">
              <strong>SOP</strong>
            </td>
            <td style="border: 1px solid #000; padding: 4px 8px;">Halaman</td>
            <td style="border: 1px solid #000; padding: 4px 8px;">${pageNo}/${totalTargetPages}</td>
          </tr>
          <tr>
            <td style="border: 1.5px solid #000; padding: 6px 8px; text-align: center;">
              <strong>${profile.namaPuskesmas.toUpperCase()}</strong>
            </td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px 8px; text-align: center;">
              <div>Penanggung Jawab,</div>
              <div style="font-weight: bold; text-decoration: underline; margin-top: 24px;">${profile.kepalaPuskesmas}</div>
              <div style="font-size: 8.5pt;">NIP. ${profile.nipKepala}</div>
            </td>
          </tr>
        </table>`;
      } else {
        titleHtml = `<div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 13pt; font-weight: 900; text-transform: uppercase;">${doc.title}</div>
          <div style="font-size: 9.5pt; font-weight: bold; margin-top: 4px;">NOMOR: ${doc.docNumber || '440/PKM/2026'}</div>
        </div>`;
      }
    }

    // Sections
    const sectionsHtml = pageSections.map((sec) => `
      <div style="margin-bottom: 14px;">
        <div style="font-weight: bold; font-size: 10pt; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
          ${sec.title}
        </div>
        <div style="font-size: 9.5pt; line-height: 1.6; white-space: pre-wrap;">
          ${substituteVariables(sec.content, variables)}
        </div>
      </div>
    `).join('');

    // Sign off if last page
    let signOffHtml = '';
    if (pageNo === totalTargetPages && doc.docType !== 'SOP') {
      signOffHtml = `<div style="margin-top: 30px; display: flex; justify-content: flex-end;">
        <div style="text-align: right; font-size: 9.5pt; line-height: 1.5; width: 250px;">
          <div>Ditetapkan di: ${profile.kabupatenKota}</div>
          <div>Pada tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div style="font-weight: bold; margin-top: 8px;">${profile.jabatanKepala.toUpperCase()},</div>
          <div style="height: 50px;"></div>
          <div style="font-weight: bold; text-decoration: underline;">${profile.kepalaPuskesmas}</div>
          <div style="font-size: 9pt;">NIP. ${profile.nipKepala}</div>
        </div>
      </div>`;
    }

    // Page number
    const pageNumHtml = showPageNumber ? `
      <div style="${positionStyles[pageNumberPosition] || positionStyles['bottom-right']} font-size: 9pt; font-family: monospace; color: #444;">
        Halaman ${pageNo} dari ${totalTargetPages}
      </div>
    ` : '';

    return `
      <div class="print-page" style="page-break-after: always; position: relative; padding: 20mm; box-sizing: border-box; min-height: 297mm; max-height: 297mm;">
        ${kopHtml}
        ${titleHtml}
        ${sectionsHtml}
        ${signOffHtml}
        ${pageNumHtml}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${doc.title}</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
            background: #fff;
          }
          @media print {
            .print-page {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;
}
