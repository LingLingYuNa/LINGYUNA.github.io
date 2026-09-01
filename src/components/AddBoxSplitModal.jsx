import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Camera, Check } from 'lucide-react';
import { db } from '../db';
import { compressImage } from '../utils';
import { useHardwareBack } from '../hooks/useHardwareBack';

export const BOX_SPLIT_MODES = [
  { id: 'time_first', label: '先喊先贏', desc: '只看參團人員發訊息的時間' },
  { id: 'amount_first', label: '金額多帶優先', desc: '參團人員購買總金額較多者優先' },
  { id: 'qty_first', label: '數量帶多優先', desc: '參團人員購買總數量較多者優先' },
  { id: 'allin_time_first', label: '該選項 ALL IN 外加先喊先贏', desc: '限包下該品項全數數量才算有效訊息' }
];

export const BOX_SPLIT_STATUSES = [
  '已喊單',
  '已下單',
  '拆團中',
  '二補中',
  '已到貨',
  '已完結'
];

export default function AddBoxSplitModal({ existingSplit, onClose, onSuccess }) {
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);

  const [title, setTitle] = useState(existingSplit?.title || '');
  const [tagsInput, setTagsInput] = useState(
    existingSplit?.tags ? (Array.isArray(existingSplit.tags) ? existingSplit.tags.join(' ') : existingSplit.tags) : ''
  );
  const [mode, setMode] = useState(existingSplit?.mode || 'time_first');
  const [status, setStatus] = useState(existingSplit?.status || '已喊單');
  const [totalAmount, setTotalAmount] = useState(existingSplit?.total_amount ?? '');
  const [useMultiplier, setUseMultiplier] = useState(existingSplit?.use_multiplier ?? false);
  const [priceAdjustType, setPriceAdjustType] = useState(existingSplit?.price_adjust_type || 'none'); // 'none' | 'normal' | 'aggressive'
  const [coverImage, setCoverImage] = useState(existingSplit?.cover_image || '');
  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useHardwareBack(true, onClose, 'add-box-split-modal');

  // 解析標籤 (以空格或逗點切割)
  const parseTags = (str) => {
    if (!str) return [];
    return str
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 800);
        setCoverImage(compressed);
      } catch (err) {
        console.error('壓縮圖片失敗:', err);
        alert('照片載入失敗，請重試');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('請填寫團名！');
      return;
    }

    setIsSaving(true);
    try {
      const parsedTags = parseTags(tagsInput);
      const data = {
        title: title.trim(),
        tags: parsedTags,
        mode,
        status,
        total_amount: Number(totalAmount) || 0,
        use_multiplier: Boolean(useMultiplier),
        price_adjust_type: priceAdjustType,
        cover_image: coverImage,
        date: existingSplit?.date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      };

      if (existingSplit) {
        await db.box_splits.update(existingSplit.id, data);
      } else {
        const id = await db.box_splits.add({
          ...data,
          second_shipping_fee: 0,
          created_at: new Date().toISOString()
        });
        if (onSuccess) onSuccess(id);
      }

      onClose();
    } catch (err) {
      console.error('儲存拆團失敗:', err);
      alert('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-gray-50 dark:bg-gray-900 w-full h-full md:w-full md:max-w-xl md:h-auto md:max-h-[90vh] md:rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>{existingSplit ? '編輯拆團紀錄' : '建立全新拆團'}</span>
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 pb-32 md:pb-6 space-y-5">
          
          {/* 團名 */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <span>團名</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：原神 4.8 官方盲盒拆團、崩鐵立牌揪團..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
            />
          </div>

          {/* 標籤 (空格或逗號截斷) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">標籤</label>
              <span className="text-[10px] text-gray-400 font-medium">(以空格或逗點「,」分隔標籤)</span>
            </div>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例如：原神 徽章 盲盒 預售"
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
            />
            {parseTags(tagsInput).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parseTags(tagsInput).map((t, idx) => (
                  <span key={idx} className="bg-primary/10 text-primary-dark dark:text-primary-light px-2.5 py-0.5 rounded-none text-xs font-bold border border-primary/20">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 模式 (單選) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">喊單與優先模式 (單選)</label>
            <div className="grid grid-cols-1 gap-2">
              {BOX_SPLIT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`p-3 rounded-none border text-left transition-all flex items-start justify-between ${
                    mode === m.id
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs sm:text-sm block">{m.label}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">{m.desc}</span>
                  </div>
                  {mode === m.id && (
                    <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 進度 (單選) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">團務進度 (單選)</label>
            <div className="flex flex-wrap gap-2">
              {BOX_SPLIT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3.5 py-2 rounded-none text-xs font-bold transition-all border ${
                    status === s
                      ? 'bg-primary text-white border-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 總金額與調價選項 */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black dark:text-white uppercase">拆團總金額 (NT$)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="例如：1200 (會依品項金額或總價自動平攤)"
                className="w-full bg-white dark:bg-gray-800 border-4 border-black rounded-none px-4 py-2.5 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white placeholder:text-gray-400"
              />
            </div>

            {/* 品項熱度價差模式選擇 (單選) */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-black dark:text-white uppercase">品項熱度價差模式 (spread_mode)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('none')}
                  className={`p-2.5 border-2 border-black font-black text-xs transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    priceAdjustType === 'none'
                      ? 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span className="font-bold">不調價</span>
                  <span className="text-[9px] font-mono text-gray-500 font-normal">均價平攤</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('low')}
                  className={`p-2.5 border-2 border-black font-black text-xs transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    priceAdjustType === 'low'
                      ? 'bg-[#A8E6CF] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span className="font-bold">極小價差</span>
                  <span className="text-[9px] font-mono text-gray-700 font-normal">low (20%內)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('balanced')}
                  className={`p-2.5 border-2 border-black font-black text-xs transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    priceAdjustType === 'balanced' || priceAdjustType === 'normal'
                      ? 'bg-[#FFE66D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span className="font-bold">標準階梯</span>
                  <span className="text-[9px] font-mono text-gray-700 font-normal">balanced (等差)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('high')}
                  className={`p-2.5 border-2 border-black font-black text-xs transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    priceAdjustType === 'high' || priceAdjustType === 'aggressive'
                      ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span className="font-bold">大價差</span>
                  <span className="text-[9px] font-mono text-white/90 font-normal">high (次方曲線)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 封面照片 (選填) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">拆團封面照片 (選填)</label>
            <div className="flex items-center gap-4">
              {coverImage ? (
                <div className="w-20 h-20 rounded-none border border-gray-200 dark:border-gray-700 overflow-hidden relative group shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <img src={coverImage} alt="封面預覽" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-none border border-dashed border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-400 shrink-0">
                  <ImageIcon size={24} />
                  <span className="text-[10px] mt-1">無照片</span>
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <Camera size={14} className="text-primary" />
                    <span>拍照</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => albumInputRef.current?.click()}
                    className="py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <ImageIcon size={14} className="text-primary" />
                    <span>相簿</span>
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={albumInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="貼上外部圖片網址..."
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-3 py-1.5 text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInput.trim()) {
                        setCoverImage(urlInput.trim());
                        setUrlInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 rounded-none font-bold text-xs shrink-0 transition-colors"
                  >
                    套用
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex gap-3 shrink-0 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none font-bold text-xs hover:bg-gray-200 transition-colors active:scale-95"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="flex-1 py-3 px-4 bg-primary text-white rounded-none font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-95"
          >
            {isSaving ? '儲存中...' : (existingSplit ? '儲存變更' : '建立拆團')}
          </button>
        </div>
      </div>
    </div>
  );
}
