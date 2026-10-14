import React, { useState } from 'react';
import {
  getPaperSize,
  savePaperSize,
  PAPER_SIZE_PRESETS,
  PaperSizeId,
  PaperSizeSetting,
} from '../utils/storage';

interface PaperSizeSelectorProps {
  onNotify?: (msg: string) => void;
  compact?: boolean;
}

/** Pilihan ukuran kertas untuk ekspor Word (.docx), termasuk ukuran custom. */
export const PaperSizeSelector: React.FC<PaperSizeSelectorProps> = ({ onNotify, compact }) => {
  const [setting, setSetting] = useState<PaperSizeSetting>(getPaperSize());

  const apply = (next: PaperSizeSetting) => {
    setSetting(next);
    savePaperSize(next);
  };

  const handleIdChange = (id: PaperSizeId) => {
    if (id === 'custom') {
      apply({ id, widthMm: setting.widthMm || 210, heightMm: setting.heightMm || 297 });
    } else {
      const preset = PAPER_SIZE_PRESETS[id];
      apply({ id, widthMm: preset.widthMm, heightMm: preset.heightMm });
    }
    if (onNotify) onNotify('Ukuran kertas disimpan.');
  };

  return (
    <div className={`flex ${compact ? 'flex-row' : 'flex-col'} items-center gap-2`}>
      {!compact && (
        <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
          Ukuran Kertas
        </label>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={setting.id}
          onChange={(e) => handleIdChange(e.target.value as PaperSizeId)}
          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
          title="Pilih ukuran kertas untuk ekspor Word"
        >
          {(Object.keys(PAPER_SIZE_PRESETS) as Array<keyof typeof PAPER_SIZE_PRESETS>).map((id) => (
            <option key={id} value={id}>
              {PAPER_SIZE_PRESETS[id].label}
            </option>
          ))}
          <option value="custom">Custom...</option>
        </select>

        {setting.id === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="number"
              min={50}
              max={1000}
              value={setting.widthMm}
              onChange={(e) => apply({ ...setting, widthMm: Number(e.target.value) || 0 })}
              className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              title="Lebar (mm)"
            />
            <span className="font-bold">×</span>
            <input
              type="number"
              min={50}
              max={1000}
              value={setting.heightMm}
              onChange={(e) => apply({ ...setting, heightMm: Number(e.target.value) || 0 })}
              className="w-20 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              title="Tinggi (mm)"
            />
            <span className="text-[10px] text-slate-400">mm</span>
          </div>
        )}
      </div>
    </div>
  );
};
