/** Katalog preset AI agent: gratis & berbayar, tinggal klik lalu isi key (bila perlu). */
export interface AgentPreset {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  /** true = langsung pakai tanpa API key */
  noKey?: boolean;
  badge: string;
  keyHint: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'pollinations',
    name: 'Pollinations',
    endpoint: 'https://text.pollinations.ai/openai',
    model: 'openai',
    noKey: true,
    badge: 'Gratis • tanpa daftar',
    keyHint: 'Tidak perlu API key — langsung bisa dipakai setelah disimpan.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    badge: 'Gratis • daftar',
    keyHint: 'Daftar gratis di openrouter.ai (bisa pakai akun Google) → menu API Keys → Create Key. Model bertanda :free tidak dipungut biaya.',
  },
  {
    id: 'groq',
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    badge: 'Gratis • daftar',
    keyHint: 'Daftar gratis di console.groq.com (bisa pakai akun Google) → API Keys → Create API Key. Tier gratis sangat longgar untuk dokumen.',
  },
  {
    id: 'meta',
    name: 'Muse (Meta)',
    endpoint: 'https://api.meta.ai/v1/chat/completions',
    model: 'muse-spark-1.3',
    badge: 'Berbayar',
    keyHint: 'Buat API key di dashboard dev.meta.ai (format LLM|...). Model yang sama dengan asisten Muse, tapi tanpa ingatan tentangmu.',
  },
  {
    id: 'manual',
    name: 'Manual',
    endpoint: '',
    model: '',
    badge: 'Isi sendiri',
    keyHint: 'Untuk OpenAI, DeepSeek, atau endpoint lain yang kompatibel OpenAI — isi semua kolom manual.',
  },
];
