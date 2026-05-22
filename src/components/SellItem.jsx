import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { db } from '../db';
import { compressImage } from '../utils';

export default function SellItem({ item, remainingQty, existingSale, onClose }) {
  const [quantity, setQuantity] = useState(existingSale?.quantity || 1);
  const [price, setPrice] = useState(existingSale?.price || '');
  const [buyerId, setBuyerId] = useState(existingSale?.buyer_id || '');
  const [image, setImage] = useState(existingSale?.image || '');
  const [isSaving, setIsSaving] = useState(false);

  const maxQty = remainingQty + (existingSale ? existingSale.quantity : 0);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setImage(compressed);
      } catch (error) {
        console.error('圖片壓縮失敗:', error);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!price || quantity < 1 || quantity > maxQty) return;

    setIsSaving(true);
    try {
      const saleData = {
        item_id: item.id,
        quantity: Number(quantity),
        price: Number(price), // 售出總金額 (台幣)
        buyer_id: buyerId,
        image,
      };

      if (existingSale) {
        await db.sales.update(existingSale.id, saleData);
      } else {
        await db.sales.add({
          ...saleData,
          created_at: new Date().toISOString(),
        });
      }
      onClose(); // 儲存後關閉
    } catch (error) {
      console.error('儲存售出紀錄失敗:', error);
      alert('寫入失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!window.confirm('確定要刪除這筆售出紀錄嗎？此物品將會自動退回庫存。')) return;
    setIsSaving(true);
    try {
      await db.sales.delete(existingSale.id);
      onClose();
    } catch (error) {
      console.error('刪除售出紀錄失敗:', error);
      alert('刪除失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // 半透明背景的 Modal
    <div 
      className="fixed inset-0 z-[70] bg-gray-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors border border-gray-100 dark:border-gray-700/50">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary-light/80 dark:bg-secondary-dark/30 text-secondary-dark dark:text-secondary-light flex items-center justify-center">
                <DollarSign size={18} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {existingSale ? '編輯售出紀錄' : '售出紀錄 (回血)'}
              </h2>
            </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* 物品資訊卡片 */}
          <div className="bg-secondary-light/30 dark:bg-secondary-dark/10 border border-secondary-light dark:border-secondary-dark/30 p-3.5 rounded-2xl text-sm font-medium flex justify-between items-center transition-colors">
            <div>
              <span className="text-secondary-dark dark:text-secondary font-bold">{item.name}</span>
              {item.character && <span className="text-secondary-dark/80 dark:text-secondary/80 ml-1">({item.character})</span>}
            </div>
            <div className="text-secondary-dark dark:text-secondary-light text-xs font-bold bg-secondary-light/80 dark:bg-secondary-dark/30 px-2 py-1 rounded-lg transition-colors">
              可用額度: {maxQty}
            </div>
          </div>

          {/* 售出數量 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">售出數量</label>
            <input
              type="number"
              required
              min="1"
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 售出總金額 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">售出總金額 (NT$)</label>
            <input
              type="number"
              required
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 買家暱稱 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">買家帳號/暱稱 (選填)</label>
            <input
              type="text"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              placeholder="例如：@buyer_123"
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 包裝/證明照片上傳 (選填) */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">包裝/證明照片 (選填)</label>
            <div className="flex items-center gap-4">
              {image && (
                <img src={image} alt="預覽" className="w-12 h-12 object-cover rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm shrink-0" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-secondary-light/80 dark:file:bg-gray-700 file:text-secondary-dark dark:file:text-secondary-light hover:file:bg-secondary-light dark:hover:file:bg-gray-600 transition-colors w-full"
              />
            </div>
          </div>

          {/* 動作按鈕 */}
          <div className="pt-2 flex gap-2">
            {existingSale && (
              <button
                type="button"
                onClick={handleDeleteSale}
                disabled={isSaving}
                className="flex-1 py-3.5 px-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 active:bg-red-200 transition-colors disabled:opacity-50"
              >
                刪除紀錄
              </button>
            )}
            <button 
              type="submit"
              disabled={isSaving || !price || quantity > maxQty || quantity < 1}
              className="flex-1 py-3.5 px-4 bg-secondary-dark text-white rounded-xl font-bold shadow-sm shadow-secondary-dark/30 hover:bg-secondary-dark/95 active:bg-secondary-dark transition-colors disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isSaving ? '處理中...' : (existingSale ? '儲存變更' : '確認售出')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
