import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, FileText, Clipboard, Check, DollarSign } from 'lucide-react';
import { db } from '../db';

export default function ReconciliationModal({ onClose }) {
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [shippingFee, setShippingFee] = useState(60);
  const [generatedText, setGeneratedText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // 訂閱 sales 與 items 資料表
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const items = useLiveQuery(() => db.items.toArray()) || [];

  // 取得不重複的買家名稱清單
  const uniqueBuyers = Array.from(new Set(sales.map(s => s.buyer_id).filter(Boolean))).sort();

  // 當選取的買家、運費或關聯數據改變時，動態更新對帳文案
  useEffect(() => {
    if (!selectedBuyer) {
      setGeneratedText('');
      return;
    }

    const buyerSales = sales.filter(s => s.buyer_id === selectedBuyer);
    
    let subtotal = 0;
    const lines = buyerSales.map(s => {
      const item = items.find(i => i.id === s.item_id);
      const itemName = item 
        ? (item.character ? `【${item.character}】${item.name}` : item.name) 
        : '未知物品';
      subtotal += Number(s.price);
      return `- ${itemName} (x${s.quantity}) = ${s.price} 元`;
    });

    const total = subtotal + Number(shippingFee);

    const template = `哈囉 ${selectedBuyer}！為您核對本次明細：

${lines.join('\n')}

運費：${shippingFee} 元
----------------
總計：${total} 元

確認無誤後請再幫我匯款/下單，謝謝！`;

    setGeneratedText(template);
  }, [selectedBuyer, shippingFee, sales, items]);

  // 預設選取第一個買家
  useEffect(() => {
    if (uniqueBuyers.length > 0 && !selectedBuyer) {
      setSelectedBuyer(uniqueBuyers[0]);
    }
  }, [uniqueBuyers, selectedBuyer]);

  const handleCopy = async () => {
    if (!generatedText) return;
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // 降級處理：若 Clipboard API 不可用則使用 textarea select & copy
      const textarea = document.getElementById('recon-textarea');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  return (
    // 半透明背景 Modal
    <div 
      className="fixed inset-0 z-[70] bg-gray-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors border border-gray-100 dark:border-gray-700/50">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary-light/80 dark:bg-secondary-dark/30 text-secondary-dark dark:text-secondary-light flex items-center justify-center">
              <FileText size={18} strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              🧾 買家對帳管家
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {uniqueBuyers.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 transition-colors">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                目前尚無登記買家的售出紀錄。<br/>請先在物品明細中登記「售出 (回血)」！
              </p>
            </div>
          ) : (
            <>
              {/* 篩選與設定格 */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* 選擇買家 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">選擇買家</label>
                  <div className="relative">
                    <select
                      value={selectedBuyer}
                      onChange={(e) => setSelectedBuyer(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all appearance-none text-gray-800 dark:text-gray-100"
                    >
                      {uniqueBuyers.map(buyer => (
                        <option key={buyer} value={buyer}>{buyer}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 附加運費 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">附加運費 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* 對帳文案預覽 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">對帳文案預覽</label>
                <textarea
                  id="recon-textarea"
                  readOnly
                  value={generatedText}
                  className="w-full h-48 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-xs font-mono focus:outline-none text-gray-800 dark:text-gray-200 resize-none transition-colors"
                />
              </div>

              {/* 複製與關閉按鈕 */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex-1 py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 ${
                    copySuccess
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'bg-secondary text-white shadow-sm shadow-secondary/20 hover:bg-secondary-dark'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <Check size={16} strokeWidth={2.5} />
                      <span>已複製到剪貼簿！</span>
                    </>
                  ) : (
                    <>
                      <Clipboard size={16} strokeWidth={2.5} />
                      <span>📋 複製對帳文案</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
