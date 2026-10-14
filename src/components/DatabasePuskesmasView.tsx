import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Database,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Download,
  RotateCcw,
  Copy,
  Sparkles,
  Check,
  X,
  Upload,
  Folder,
  Wand2,
  FileText,
  RefreshCw,
  Sliders,
  Eye,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { PuskesmasDatabaseItem, DatabaseCategory, DatabaseMetric, IlpKlaster, MediaItem } from '../types';
import { getStoredDatabase, saveDatabaseItem, deleteDatabaseItem, resetDatabaseToDefault, getStoredMedia, getStoredAgentConfig } from '../utils/storage';
import { ILP_KLASTERS } from '../utils/constants';
import { extractTextFromDocx, extractDocxAsHtml, renderDocxToContainer } from '../utils/docxReader';
import { aiAnalyzeDatabaseDocument } from '../lib/aiAgent';

interface DatabasePuskesmasViewProps {
  onSelectForGenerator?: (item: PuskesmasDatabaseItem) => void;
  onNavigateToGenerator?: () => void;
}

export const DatabasePuskesmasView: React.FC<DatabasePuskesmasViewProps> = ({
  onSelectForGenerator,
  onNavigateToGenerator,
}) => {
  const [databaseList, setDatabaseList] = useState<PuskesmasDatabaseItem[]>(getStoredDatabase());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PuskesmasDatabaseItem | null>(null);
  const [modalTab, setModalTab] = useState<'form' | 'ai_extract' | 'ai_result'>('form');

  // Hasil ekstraksi AI (untuk preview sebelum disimpan)
  interface AiExtractedData {
    title: string; category: string; period: string; klaster: string;
    summary: string; notes: string; metrics: DatabaseMetric[];
  }
  const [aiExtractResult, setAiExtractResult] = useState<AiExtractedData | null>(null);
  const [aiRegenPrompt, setAiRegenPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Preview dokumen asli (high-fidelity) sebelum ekstraksi
  const [aiDocPreviewBase64, setAiDocPreviewBase64] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const docPreviewRef = useRef<HTMLDivElement | null>(null);

  // Form State for Modal
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<string>('capaian_program');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [formPeriod, setFormPeriod] = useState('Tahun 2026');
  const [formKlaster, setFormKlaster] = useState<IlpKlaster>('KLASTER_1');
  const [formSummary, setFormSummary] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMetrics, setFormMetrics] = useState<DatabaseMetric[]>([
    { key: '', value: '', target: '', unit: '%', status: 'tercapai' },
  ]);

  // AI Extraction & AI Edit Prompt State
  const [aiDocText, setAiDocText] = useState('');
  const [aiExtractPrompt, setAiExtractPrompt] = useState('');
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isEditingAI, setIsEditingAI] = useState(false);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);

  // Media picker modal for choosing a document
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>(getStoredMedia());
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  const triggerNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Render preview dokumen asli (sesuai tampilan Word) saat panel dibuka
  useEffect(() => {
    if (showDocPreview && aiDocPreviewBase64 && docPreviewRef.current) {
      renderDocxToContainer(aiDocPreviewBase64, docPreviewRef.current).catch(() => {
        if (docPreviewRef.current) {
          docPreviewRef.current.innerHTML = '<p class="text-xs text-slate-400 p-4">Gagal merender preview dokumen.</p>';
        }
      });
    }
  }, [showDocPreview, aiDocPreviewBase64]);

  // Filtered list
  const filteredList = useMemo(() => {
    return databaseList.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;

      const inTitle = item.title.toLowerCase().includes(q);
      const inSummary = item.summary.toLowerCase().includes(q);
      const inPeriod = (item.period || '').toLowerCase().includes(q);
      const inMetrics = item.metrics.some(
        (m) => m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)
      );
      return matchCat && (inTitle || inSummary || inPeriod || inMetrics);
    });
  }, [databaseList, selectedCategory, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalMetrics = 0;
    let tercapai = 0;
    let belumTercapai = 0;
    let pantauan = 0;

    databaseList.forEach((item) => {
      item.metrics.forEach((m) => {
        totalMetrics++;
        if (m.status === 'tercapai') tercapai++;
        else if (m.status === 'belum_tercapai') belumTercapai++;
        else pantauan++;
      });
    });

    return {
      totalItems: databaseList.length,
      totalMetrics,
      tercapai,
      belumTercapai,
      pantauan,
    };
  }, [databaseList]);

  // Open Modal for Create
  const handleOpenCreateModal = (preferAi: boolean = false) => {
    setEditingItem(null);
    setAiExtractResult(null);
    setAiRegenPrompt('');
    setAiDocPreviewBase64(null);
    setShowDocPreview(false);
    setFormTitle('');
    setFormCategory('capaian_program');
    setIsCustomCategoryMode(false);
    setCustomCategoryInput('');
    setFormPeriod('Tahun 2026');
    setFormKlaster('KLASTER_1');
    setFormSummary('');
    setFormNotes('');
    setFormMetrics([
      { key: 'Indikator Utama 1', value: '85%', target: '100%', unit: '%', status: 'tercapai' },
      { key: 'Indikator Utama 2', value: '70%', target: '100%', unit: '%', status: 'belum_tercapai' },
    ]);
    setAiDocText('');
    setAiExtractPrompt('');
    setAiEditPrompt('');
    setUploadedDocName(null);
    setModalTab(preferAi ? 'ai_extract' : 'form');
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: PuskesmasDatabaseItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    const isStandard = Object.keys(categoryLabels).includes(item.category);
    if (isStandard) {
      setFormCategory(item.category);
      setIsCustomCategoryMode(false);
      setCustomCategoryInput('');
    } else {
      setFormCategory('kustom');
      setIsCustomCategoryMode(true);
      setCustomCategoryInput(item.category);
    }
    setFormPeriod(item.period || 'Tahun 2026');
    setFormKlaster(item.klaster || 'KLASTER_1');
    setFormSummary(item.summary);
    setFormNotes(item.notes || '');
    setFormMetrics(item.metrics.length > 0 ? [...item.metrics] : [{ key: '', value: '', status: 'tercapai' }]);
    setAiEditPrompt('');
    setUploadedDocName(null);
    setModalTab('form');
    setIsModalOpen(true);
  };

  // Add / Remove Metric in Form
  const handleAddMetricRow = () => {
    setFormMetrics((prev) => [...prev, { key: '', value: '', target: '', unit: '%', status: 'tercapai' }]);
  };

  const handleUpdateMetricRow = (idx: number, field: keyof DatabaseMetric, val: any) => {
    setFormMetrics((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveMetricRow = (idx: number) => {
    setFormMetrics((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload Document File (.docx, .txt, .csv, dll)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedDocName(file.name);
    setAiDocPreviewBase64(null);
    setShowDocPreview(false);
    try {
      if (file.name.endsWith('.docx')) {
        triggerNotice(`Mengekstrak teks dari Word: ${file.name}...`);
        const docxResult = await extractDocxAsHtml(file);
        setAiDocText(docxResult.rawText);
        if (docxResult.base64) setAiDocPreviewBase64(docxResult.base64);
      } else {
        const text = await file.text();
        setAiDocText(text);
      }
      triggerNotice(`Berkas "${file.name}" siap dianalisis oleh AI.`);
    } catch (err: any) {
      triggerNotice(`Gagal membaca berkas: ${err.message}`);
    }
  };

  // Pick Document from Media Library
  const handleSelectMediaDocument = async (mediaItem: MediaItem) => {
    setIsMediaPickerOpen(false);
    setUploadedDocName(mediaItem.name);

    try {
      setAiDocPreviewBase64(null);
      setShowDocPreview(false);
      if (mediaItem.name.endsWith('.docx') || mediaItem.mimeType?.includes('word')) {
        triggerNotice(`Mengunduh dan mengekstrak "${mediaItem.name}" dari Pustaka Media...`);
        const res = await fetch(mediaItem.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], mediaItem.name, { type: mediaItem.mimeType });
        const docxResult = await extractDocxAsHtml(file);
        setAiDocText(docxResult.rawText);
        if (docxResult.base64) setAiDocPreviewBase64(docxResult.base64);
      } else if (mediaItem.dataUrl.startsWith('data:text')) {
        const base64Part = mediaItem.dataUrl.split(',')[1];
        const text = atob(base64Part);
        setAiDocText(text);
      } else {
        const res = await fetch(mediaItem.dataUrl);
        const text = await res.text();
        setAiDocText(text);
      }
      triggerNotice(`Dokumen "${mediaItem.name}" berhasil dimuat dari Pustaka Media!`);
    } catch (err: any) {
      triggerNotice(`Gagal membaca media: ${err.message}`);
    }
  };

  // Call Server AI to Analyze Document and Convert to Database Format
  const handleExecuteAiAnalysis = async () => {
    if (!aiDocText.trim()) {
      triggerNotice('Harap unggah berkas, pilih dari pustaka media, atau tempel teks dokumen terlebih dahulu!');
      return;
    }

    setIsAnalyzingAI(true);
    const agentConfig = getStoredAgentConfig();

    try {
      const json = await aiAnalyzeDatabaseDocument({
        documentText: aiDocText,
        customPrompt: aiExtractPrompt.trim() || undefined,
        customAgentConfig: agentConfig.enabled ? agentConfig : undefined,
      });

      if (json.success && json.data) {
        const d = json.data;
        setAiExtractResult({
          title: d.title || 'Data Hasil Ekstraksi AI',
          category: d.category || 'kustom',
          period: d.period || '',
          klaster: d.klaster || 'KLASTER_1',
          summary: d.summary || '',
          notes: d.notes || '',
          metrics: Array.isArray(d.metrics) ? d.metrics : [],
        });
        setModalTab('ai_result'); // Tampilkan preview hasil ekstrak!
        triggerNotice('Dokumen berhasil dianalisis AI! Periksa preview hasilnya.');
      } else {
        triggerNotice(`Gagal analisis AI: ${json.error || 'Respon tidak valid'}`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal menghubungi server AI: ${err.message}`);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Generate ulang hasil ekstraksi dengan prompt yang diedit (dari tab preview hasil)
  const handleRegenerateExtract = async () => {
    if (!aiRegenPrompt.trim()) {
      triggerNotice('Tuliskan perintah/instruksi untuk generate ulang terlebih dahulu!');
      return;
    }
    if (!aiExtractResult) return;
    setIsRegenerating(true);
    const agentConfig = getStoredAgentConfig();
    try {
      const json = await aiAnalyzeDatabaseDocument({
        documentText: aiDocText || undefined,
        customPrompt: `Generate ulang data berikut sesuai perintah ini: "${aiRegenPrompt.trim()}". Perhatikan akurasi nama metrik, angka, status, dan rekomendasi.`,
        currentData: aiExtractResult,
        customAgentConfig: agentConfig.enabled ? agentConfig : undefined,
      });
      if (json.success && json.data) {
        const d = json.data;
        setAiExtractResult({
          title: d.title || aiExtractResult.title,
          category: d.category || aiExtractResult.category,
          period: d.period || aiExtractResult.period,
          klaster: d.klaster || aiExtractResult.klaster,
          summary: d.summary || aiExtractResult.summary,
          notes: d.notes || aiExtractResult.notes,
          metrics: Array.isArray(d.metrics) && d.metrics.length > 0 ? d.metrics : aiExtractResult.metrics,
        });
        setAiRegenPrompt('');
        triggerNotice('Hasil ekstraksi berhasil di-generate ulang sesuai perintah Anda!');
      } else {
        triggerNotice(`Gagal generate ulang: ${json.error || 'Respon tidak valid'}`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal menghubungi server AI: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Pindahkan hasil preview ke form untuk edit manual
  const handleResultToForm = () => {
    if (!aiExtractResult) return;
    const r = aiExtractResult;
    setFormTitle(r.title);
    setFormCategory(r.category);
    setFormPeriod(r.period);
    setFormKlaster(r.klaster as IlpKlaster);
    setFormSummary(r.summary);
    setFormNotes(r.notes);
    setFormMetrics(r.metrics.length > 0 ? r.metrics : [{ key: '', value: '', target: '', unit: '%', status: 'tercapai' }]);
    setModalTab('form');
  };

  // Simpan langsung hasil ekstraksi ke database
  const handleSaveExtractResult = () => {
    if (!aiExtractResult) return;
    const r = aiExtractResult;
    const cleanedMetrics = r.metrics.filter((m) => (m.key || '').trim().length > 0);
    const now = new Date().toISOString();
    saveDatabaseItem({
      id: editingItem ? editingItem.id : 'db_' + Date.now(),
      title: r.title.trim(),
      category: r.category as DatabaseCategory,
      period: r.period.trim(),
      klaster: r.klaster as IlpKlaster,
      summary: r.summary.trim() || 'Data capaian operasional Puskesmas.',
      metrics: cleanedMetrics,
      notes: r.notes.trim(),
      updatedAt: now,
      createdAt: editingItem ? editingItem.createdAt : now,
    });
    setDatabaseList(getStoredDatabase());
    setIsModalOpen(false);
    setAiExtractResult(null);
    triggerNotice('Hasil ekstraksi AI berhasil disimpan ke Database Puskesmas!');
  };

  // AI Refinement / Edit with Custom Prompt
  const handleExecuteAiEdit = async () => {
    if (!aiEditPrompt.trim()) {
      triggerNotice('Tuliskan prompt instruksi perbaikan AI terlebih dahulu!');
      return;
    }

    setIsEditingAI(true);
    const agentConfig = getStoredAgentConfig();

    try {
      const currentDataSnapshot = {
        title: formTitle,
        category: formCategory,
        period: formPeriod,
        klaster: formKlaster,
        summary: formSummary,
        metrics: formMetrics,
        notes: formNotes,
      };

      const json = await aiAnalyzeDatabaseDocument({
        documentText: aiDocText || undefined,
        customPrompt: `Perbaiki data berikut sesuai perintah ini: "${aiEditPrompt.trim()}". Perhatikan akurasi nama metrik, angka, status, dan rekomendasi.`,
        currentData: currentDataSnapshot,
        customAgentConfig: agentConfig.enabled ? agentConfig : undefined,
      });

      if (json.success && json.data) {
        const d = json.data;
        if (d.title) setFormTitle(d.title);
        if (d.category) setFormCategory(d.category);
        if (d.period) setFormPeriod(d.period);
        if (d.klaster) setFormKlaster(d.klaster);
        if (d.summary) setFormSummary(d.summary);
        if (d.notes) setFormNotes(d.notes);
        if (Array.isArray(d.metrics) && d.metrics.length > 0) {
          setFormMetrics(d.metrics);
        }

        setAiEditPrompt('');
        triggerNotice('Data berhasil diperbaiki oleh AI sesuai instruksi prompt Anda!');
      } else {
        triggerNotice(`Gagal perbaikan AI: ${json.error || 'Respon tidak valid'}`);
      }
    } catch (err: any) {
      triggerNotice(`Gagal menghubungi server AI: ${err.message}`);
    } finally {
      setIsEditingAI(false);
    }
  };

  // Save Modal
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      triggerNotice('Judul database tidak boleh kosong!');
      return;
    }

    const cleanedMetrics = formMetrics.filter((m) => m.key.trim().length > 0);

    const effectiveCategory = (isCustomCategoryMode && customCategoryInput.trim()) 
      ? customCategoryInput.trim() 
      : formCategory;

    const now = new Date().toISOString();
    const itemToSave: PuskesmasDatabaseItem = {
      id: editingItem ? editingItem.id : 'db_' + Date.now(),
      title: formTitle.trim(),
      category: effectiveCategory as DatabaseCategory,
      period: formPeriod.trim(),
      klaster: formKlaster,
      summary: formSummary.trim() || 'Data capaian operasional Puskesmas.',
      metrics: cleanedMetrics,
      notes: formNotes.trim(),
      updatedAt: now,
      createdAt: editingItem ? editingItem.createdAt : now,
    };

    saveDatabaseItem(itemToSave);
    const updated = getStoredDatabase();
    setDatabaseList(updated);
    setIsModalOpen(false);
    triggerNotice(editingItem ? 'Data Puskesmas berhasil diperbarui!' : 'Data Puskesmas baru berhasil ditambahkan!');
  };

  // Delete Item
  const handleDeleteItem = (id: string, title: string) => {
    if (window.confirm(`Yakin ingin menghapus data "${title}"?`)) {
      deleteDatabaseItem(id);
      setDatabaseList(getStoredDatabase());
      triggerNotice(`Data "${title}" telah dihapus.`);
    }
  };

  // Reset to default
  const handleResetDefault = () => {
    if (window.confirm('Reset database ke data capaian standar Puskesmas ILP bawaan (1 contoh standar)? Data kustom akan ditimpa.')) {
      const def = resetDatabaseToDefault();
      setDatabaseList(def);
      triggerNotice('Database Puskesmas berhasil direset ke standar ILP (1 data contoh)!');
    }
  };

  // Copy Summary Text
  const handleCopySummary = (item: PuskesmasDatabaseItem) => {
    const text = `[${item.title} - ${item.period}]\n${item.summary}\n\nCapaian Indikator:\n${item.metrics
      .map((m) => `- ${m.key}: ${m.value}${m.target ? ` (Target: ${m.target})` : ''} [${m.status || ''}]`)
      .join('\n')}${item.notes ? `\n\nCatatan: ${item.notes}` : ''}`;
    navigator.clipboard.writeText(text);
    triggerNotice('Ringkasan data berhasil disalin ke clipboard!');
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(databaseList, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `database_puskesmas_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    triggerNotice('Berkas JSON database Puskesmas berhasil diunduh!');
  };

  // Helper Category Labels
  const categoryLabels: Record<string, { label: string; color: string }> = {
    spm: { label: 'Standar Pelayanan Minimal (SPM)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    indikator_mutu: { label: 'Indikator Nasional Mutu (INM)', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    capaian_program: { label: 'Capaian Program Layanan', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    demografi_sasaran: { label: 'Demografi & Sasaran Wilayah', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    sdmk_ketenagaan: { label: 'SDMK & Ketenagaan', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    sarpras_alkes: { label: 'Sarpras & Alkes (ASPAK)', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    surveilans_penyakit: { label: 'Surveilans & KLB', color: 'bg-rose-100 text-rose-800 border-rose-200' },
    kinerja_keuangan: { label: 'Kinerja BOK & Keuangan', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    kustom: { label: 'Data Kustom', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  };

  const getCategoryBadge = (catKey: string) => {
    if (categoryLabels[catKey]) {
      return categoryLabels[catKey];
    }
    return {
      label: catKey.replace(/_/g, ' '),
      color: 'bg-teal-100 text-teal-800 border-teal-200',
    };
  };

  const allCategoryKeys = useMemo(() => {
    const defaultKeys = Object.keys(categoryLabels);
    const existing = new Set<string>(defaultKeys);
    databaseList.forEach((d) => {
      if (d.category) existing.add(d.category);
    });
    return Array.from(existing);
  }, [databaseList]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {notice && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 animate-in fade-in flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-900 via-indigo-900 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Pusat Data Riil Faskes & Fakta Capaian</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Database Puskesmas & Capaian ILP
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Kumpulan data angka capaian SPM, Indikator Nasional Mutu (INM), ketenagaan, sasaran demografi, dan profil faskes. Seluruh data ini <strong>dapat dilihat dan disitir langsung oleh AI</strong> saat menghasilkan SOP, SK, KAK, dan dokumen akreditasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Tombol Tambah Data Manual */}
            <button
              onClick={() => handleOpenCreateModal(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Data Manual</span>
            </button>

            {/* Tombol Tambah Data via AI Ekstraksi Dokumen */}
            <button
              onClick={() => handleOpenCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ring-2 ring-indigo-400/30"
              title="Upload berkas Word atau ambil dari media untuk diekstrak otomatis menjadi data Puskesmas"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Ekstrak Dokumen via AI</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors cursor-pointer"
              title="Unduh cadangan data dalam format JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleResetDefault}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
              title="Reset ke data awal standar Puskesmas ILP"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-white">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">Total Kumpulan Data</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black">{stats.totalItems}</span>
              <span className="text-[10px] text-teal-300">kategori/laporan</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-300 block">Total Indikator & Metrik</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black">{stats.totalMetrics}</span>
              <span className="text-[10px] text-indigo-300">indikator terdata</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-emerald-300 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Indikator Tercapai
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-emerald-400">{stats.tercapai}</span>
              <span className="text-[10px] text-slate-300">target terpenuhi</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-2xl border border-white/10">
            <span className="text-[11px] text-rose-300 block flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Perlu Perhatian (RTL)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-rose-400">{stats.belumTercapai}</span>
              <span className="text-[10px] text-slate-300">prioritas intervensi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari indikator, nama capaian, SPM, angka, atau klaster..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Info Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>AI akan mengintegrasikan data yang dipilih pada tab Generator Dokumen</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({databaseList.length})
          </button>

          {allCategoryKeys.map((catKey) => {
            const catInfo = getCategoryBadge(catKey);
            const count = databaseList.filter((d) => d.category === catKey).length;
            if (count === 0 && selectedCategory !== catKey) return null;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === catKey
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{catInfo.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Database Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredList.map((item) => {
          const cat = getCategoryBadge(item.category);
          const klasterObj = ILP_KLASTERS.find((k) => k.id === item.klaster);

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/40 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.period || 'Periode Berjalan'}
                      </span>
                      {klasterObj && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {klasterObj.name.split(':')[0]}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  {/* Actions dropdown/buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopySummary(item)}
                      title="Salin ringkasan data"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit data ini"
                      className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.title)}
                      title="Hapus data ini"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              {/* Card Body: Metrics List */}
              <div className="p-5 flex-1 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  <span>Indikator / Metrik ({item.metrics.length})</span>
                  <span>Capaian / Target</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {item.metrics.map((metric, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 border border-slate-100 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800 block truncate" title={metric.key}>
                          {metric.key}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {metric.value} {metric.unit || ''}
                        </span>

                        {metric.target && (
                          <span className="text-[10px] text-slate-400 font-mono" title={`Target: ${metric.target}`}>
                            / {metric.target}
                          </span>
                        )}

                        {metric.status === 'tercapai' && (
                          <span className="p-1 rounded bg-emerald-100 text-emerald-700" title="Target Tercapai">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {metric.status === 'belum_tercapai' && (
                          <span className="p-1 rounded bg-rose-100 text-rose-700" title="Target Belum Tercapai">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {metric.status === 'dalam_pantauan' && (
                          <span className="p-1 rounded bg-amber-100 text-amber-700" title="Dalam Pantauan">
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Analytical Notes */}
                {item.notes && (
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Analisis & Rekomendasi Faskes: </span>
                      <span>{item.notes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Quick Actions */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  Update: {new Date(item.updatedAt).toLocaleDateString('id-ID')}
                </span>

                <button
                  onClick={() => {
                    if (onSelectForGenerator) onSelectForGenerator(item);
                    if (onNavigateToGenerator) onNavigateToGenerator();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                  title="Pilih data ini untuk dibawa ke Generator Dokumen"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Panggil ke Generator Dokumen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Tidak ada data Puskesmas yang cocok
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Coba ubah kata kunci pencarian atau buat data baru seperti capaian program, SPM, atau profil ketenagaan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handleOpenCreateModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Data Manual</span>
              </button>
              <button
                onClick={() => handleOpenCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Ekstrak Dokumen via AI</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT PUSKESMAS DATA WITH AI EXTRACTION & AI EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh] animate-in fade-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-indigo-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingItem ? 'Edit Data Puskesmas' : 'Tambah Data / Capaian Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Data ini menjadi bahan rujukan AI untuk penyusunan SOP, SK, KAK, dan pedoman
                  </p>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setModalTab('form')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      modalTab === 'form'
                        ? 'bg-white text-teal-800 shadow-xs border border-slate-200 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Form & Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('ai_extract')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      modalTab === 'ai_extract'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs font-bold'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ekstraksi AI dari Berkas</span>
                  </button>
                  {aiExtractResult && (
                    <button
                      type="button"
                      onClick={() => setModalTab('ai_result')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        modalTab === 'ai_result'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-bold'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Hasil Ekstraksi</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: AI EXTRACTION FROM DOCUMENT */}
            {modalTab === 'ai_extract' && (
              <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Fitur AI: Ekstraksi Otomatis Dokumen ke Format Database</span>
                  </div>
                  <p className="text-xs text-indigo-800/80 leading-relaxed">
                    Unggah berkas laporan (Word .docx, teks, csv) atau ambil dari Pustaka Media. AI Gemini akan membaca isi dokumen, mendeteksi judul, kategori SPM/Mutu, periode, angka capaian/indikator, status tercapai, serta catatan rekomendasi faskes secara otomatis.
                  </p>
                </div>

                {/* File Upload / Media Picker Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="file"
                    ref={fileUploadInputRef}
                    accept=".docx,.txt,.csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileUploadInputRef.current?.click()}
                    className="p-4 bg-white hover:bg-indigo-50/50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Upload Berkas dari Komputer
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Mendukung Word (.docx), teks (.txt), CSV
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMediaList(getStoredMedia());
                      setIsMediaPickerOpen(true);
                    }}
                    className="p-4 bg-white hover:bg-purple-50/50 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Pilih dari Pustaka Media
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Ambil dokumen yang sudah tersimpan di Puskesmas
                      </span>
                    </div>
                  </button>
                </div>

                {uploadedDocName && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Berkas Aktif: <strong>{uploadedDocName}</strong></span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      {aiDocText.length} karakter termuat
                    </span>
                  </div>
                )}

                {/* Preview dokumen asli (sesuai tampilan Word) */}
                {aiDocPreviewBase64 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setShowDocPreview(!showDocPreview)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-indigo-600" />
                        Preview Dokumen Asli (sesuai tampilan Word)
                      </span>
                      <span className="text-[11px] text-indigo-600 font-semibold">
                        {showDocPreview ? '▾ Sembunyikan' : '▸ Tampilkan'}
                      </span>
                    </button>
                    {showDocPreview && (
                      <div className="border-t border-slate-200 max-h-96 overflow-y-auto bg-slate-100 p-3">
                        <div ref={docPreviewRef} className="bg-white shadow-sm rounded" />
                      </div>
                    )}
                  </div>
                )}

                {/* Textarea for document text */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Isi Teks / Tabel Dokumen yang Akan Dianalisis AI
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Bisa langsung diedit atau ditempel
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={aiDocText}
                    onChange={(e) => setAiDocText(e.target.value)}
                    placeholder="Teks dokumen laporan atau tabel capaian Puskesmas akan muncul di sini setelah upload berkas, atau Anda dapat langsung menempelkan teks dari dokumen lain..."
                    className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Custom AI prompt */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Instruksi / Prompt Khusus untuk AI (Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={aiExtractPrompt}
                    onChange={(e) => setAiExtractPrompt(e.target.value)}
                    placeholder="Contoh: 'Fokuskan ekstraksi pada 12 indikator SPM dan sebutkan target 100%' atau 'Kelompokkan berdasarkan klaster ILP'..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  />
                </div>

                {/* Action button */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setModalTab('form')}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                  >
                    Batal / Beralih ke Form Manual
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteAiAnalysis}
                    disabled={isAnalyzingAI || !aiDocText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                  >
                    {isAnalyzingAI ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menganalisis Dokumen via Gemini AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>🚀 Ekstrak ke Format Database via AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: HASIL EKSTRAKSI AI (PREVIEW) */}
            {modalTab === 'ai_result' && aiExtractResult && (
              <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>Preview Hasil Ekstraksi AI</span>
                  </div>
                  <p className="text-xs text-emerald-800/80 leading-relaxed mt-1">
                    Periksa hasil di bawah. Bila kurang tepat, tulis perintah perbaikan lalu klik "Generate Ulang".
                    Bila sudah sesuai, simpan ke database atau lanjutkan edit manual di form.
                  </p>
                </div>

                {/* Ringkasan hasil */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-slate-900">{aiExtractResult.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">{aiExtractResult.category}</span>
                    {aiExtractResult.period && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">{aiExtractResult.period}</span>
                    )}
                    {aiExtractResult.klaster && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">{aiExtractResult.klaster.replace('_', ' ')}</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {aiExtractResult.metrics.length} indikator
                    </span>
                  </div>
                  {aiExtractResult.summary && (
                    <p className="text-xs text-slate-600 leading-relaxed">{aiExtractResult.summary}</p>
                  )}

                  {/* Tabel metrik */}
                  {aiExtractResult.metrics.length > 0 && (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="text-left px-3 py-2 font-bold">Indikator</th>
                            <th className="text-center px-3 py-2 font-bold">Capaian</th>
                            <th className="text-center px-3 py-2 font-bold">Target</th>
                            <th className="text-center px-3 py-2 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiExtractResult.metrics.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="px-3 py-2 font-medium text-slate-800">{m.key}</td>
                              <td className="px-3 py-2 text-center font-mono">{m.value}{m.unit ? ` ${m.unit}` : ''}</td>
                              <td className="px-3 py-2 text-center font-mono text-slate-500">{m.target || '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  m.status === 'tercapai' ? 'bg-emerald-100 text-emerald-800' :
                                  m.status === 'belum_tercapai' ? 'bg-rose-100 text-rose-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {m.status === 'tercapai' ? 'Tercapai' : m.status === 'belum_tercapai' ? 'Belum' : 'Pantauan'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {aiExtractResult.notes && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                      <span className="font-bold">Catatan AI: </span>{aiExtractResult.notes}
                    </div>
                  )}
                </div>

                {/* Edit prompt & generate ulang */}
                <div className="bg-white border border-purple-200 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Perintah Perbaikan / Generate Ulang</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={aiRegenPrompt}
                      onChange={(e) => setAiRegenPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRegenerateExtract()}
                      placeholder="cth: 'tambahkan target 100% semua indikator', 'kelompokkan per klaster', 'perbaiki angka capaian'..."
                      className="flex-1 px-3 py-2 text-xs border border-purple-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateExtract}
                      disabled={isRegenerating || !aiRegenPrompt.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
                    >
                      {isRegenerating ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Memproses...</span></>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /><span>Generate Ulang</span></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Aksi */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalTab('ai_extract')}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                  >
                    ← Kembali ke Berkas
                  </button>
                  <button
                    type="button"
                    onClick={handleResultToForm}
                    className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer"
                  >
                    Edit Manual di Form
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveExtractResult}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan ke Database</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: FORM & LIVE PREVIEW DATA (WITH AI PROMPT EDIT) */}
            {modalTab === 'form' && (
              <form onSubmit={handleSaveForm} className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* AI Refinement Prompt Bar */}
                <div className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Edit & Sempurnakan Data dengan Prompt AI</span>
                    </span>
                    <span className="text-[10px] text-purple-700 font-medium">
                      Gemini 3.8 Flash
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={aiEditPrompt}
                      onChange={(e) => setAiEditPrompt(e.target.value)}
                      placeholder="Masukkan perintah edit: misal 'Tambahkan target 100% untuk semua indikator', 'Hitung persentase', 'Perbaiki catatan RTL'..."
                      className="flex-1 px-3 py-2 text-xs border border-purple-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleExecuteAiEdit}
                      disabled={isEditingAI || !aiEditPrompt.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      {isEditingAI ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Perbaiki via AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Judul Laporan / Kumpulan Data <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Contoh: Capaian 12 Indikator SPM Kesehatan Tahun 2025"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Kategori Data</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(!isCustomCategoryMode);
                          if (!isCustomCategoryMode && !customCategoryInput) {
                            setCustomCategoryInput('');
                          }
                        }}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                      >
                        {isCustomCategoryMode ? 'Pilih Kategori Standar' : '+ Buat Kategori Manual'}
                      </button>
                    </div>

                    {isCustomCategoryMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          value={customCategoryInput}
                          onChange={(e) => setCustomCategoryInput(e.target.value)}
                          placeholder="Ketik nama kategori manual... (cth: SPM Desa, Penilaian Kinerja, dll)"
                          className="w-full px-3 py-2 text-xs border border-teal-400 bg-teal-50/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-semibold text-teal-950"
                        />
                        <span className="text-[10px] text-teal-700 block">Kategori manual ini akan otomatis terdaftar dan bisa difilter.</span>
                      </div>
                    ) : (
                      <select
                        value={formCategory}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_CUSTOM__') {
                            setIsCustomCategoryMode(true);
                            setCustomCategoryInput('');
                          } else {
                            setFormCategory(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium cursor-pointer"
                      >
                        <option value="spm">Standar Pelayanan Minimal (SPM)</option>
                        <option value="indikator_mutu">Indikator Nasional Mutu (INM)</option>
                        <option value="capaian_program">Capaian Program Layanan</option>
                        <option value="demografi_sasaran">Demografi & Sasaran Wilayah</option>
                        <option value="sdmk_ketenagaan">SDMK & Ketenagaan</option>
                        <option value="sarpras_alkes">Sarpras & Alkes (ASPAK)</option>
                        <option value="surveilans_penyakit">Surveilans & KLB</option>
                        <option value="kinerja_keuangan">Kinerja BOK & Keuangan</option>
                        <option value="kustom">Data Kustom</option>
                        <option value="__NEW_CUSTOM__">+ Buat Kategori Manual Baru...</option>
                      </select>
                    )}
                  </div>

                  {/* Period */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Periode / Waktu Data</label>
                    <input
                      type="text"
                      value={formPeriod}
                      onChange={(e) => setFormPeriod(e.target.value)}
                      placeholder="Contoh: Tahun 2025, Semester II 2025, Triwulan I 2026"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* Klaster */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Klaster ILP Terkait (Opsional)</label>
                    <select
                      value={formKlaster}
                      onChange={(e) => setFormKlaster(e.target.value as IlpKlaster)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                    >
                      {ILP_KLASTERS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.description.slice(0, 45)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Ringkasan Gambaran Umum</label>
                    <textarea
                      rows={2}
                      value={formSummary}
                      onChange={(e) => setFormSummary(e.target.value)}
                      placeholder="Ringkasan konteks data ini untuk dipahami oleh AI..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Dynamic Metrics List */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Rincian Indikator / Angka Capaian ({formMetrics.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Sesuaikan nama indikator, nilai realisasi, target, dan statusnya
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMetricRow}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {formMetrics.map((metric, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
                      >
                        {/* Metric Name */}
                        <input
                          type="text"
                          placeholder="Nama Indikator / Data"
                          value={metric.key}
                          onChange={(e) => handleUpdateMetricRow(idx, 'key', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />

                        {/* Value */}
                        <input
                          type="text"
                          placeholder="Nilai (e.g. 89%)"
                          value={metric.value}
                          onChange={(e) => handleUpdateMetricRow(idx, 'value', e.target.value)}
                          className="w-24 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />

                        {/* Target */}
                        <input
                          type="text"
                          placeholder="Target (100%)"
                          value={metric.target || ''}
                          onChange={(e) => handleUpdateMetricRow(idx, 'target', e.target.value)}
                          className="w-24 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />

                        {/* Status */}
                        <select
                          value={metric.status || 'tercapai'}
                          onChange={(e) => handleUpdateMetricRow(idx, 'status', e.target.value)}
                          className="w-36 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="tercapai">✓ Tercapai</option>
                          <option value="belum_tercapai">✗ Belum Tercapai</option>
                          <option value="dalam_pantauan">⏳ Dalam Pantauan</option>
                        </select>

                        {/* Delete row */}
                        <button
                          type="button"
                          onClick={() => handleRemoveMetricRow(idx)}
                          disabled={formMetrics.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes / Rekomendasi */}
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan Analisis & Rencana Tindak Lanjut (RTL)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Catatan masalah, kendala di lapangan, atau rekomendasi perbaikan untuk disitir oleh AI..."
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    {editingItem ? 'Simpan Perubahan' : 'Simpan ke Database Puskesmas'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PILIH DOKUMEN DARI PUSTAKA MEDIA */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pilih Dokumen dari Pustaka Media
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
                Pilih berkas dokumen laporan akreditasi (.docx, surat, notulen) yang tersimpan di Pustaka Media untuk diekstrak menjadi database:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mediaList.filter(m => m.type === 'document' || m.name.endsWith('.docx') || m.name.endsWith('.txt')).map((media) => (
                  <div
                    key={media.id}
                    onClick={() => handleSelectMediaDocument(media)}
                    className="p-3 bg-slate-50 hover:bg-purple-50/80 border border-slate-200 hover:border-purple-300 rounded-2xl cursor-pointer transition-all flex items-start gap-3 group shadow-2xs"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-800 truncate block group-hover:text-purple-700">
                        {media.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {Math.round(media.size / 1024)} KB · {media.category || 'Dokumen'}
                      </span>
                      <span className="inline-block mt-1 text-[10px] font-bold text-purple-600 group-hover:underline">
                        Pilih & Analisis via AI →
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {mediaList.filter(m => m.type === 'document' || m.name.endsWith('.docx') || m.name.endsWith('.txt')).length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                  <p className="text-xs text-slate-500">Belum ada berkas dokumen di Pustaka Media.</p>
                  <p className="text-[11px] text-slate-400">Silakan unggah dokumen Word (.docx) langsung dari komputer.</p>
                </div>
              )}
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
    </div>
  );
};
