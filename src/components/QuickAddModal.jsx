import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Trash2, Check, Zap } from 'lucide-react';
import { db } from '../db';
import { PAYMENT_METHODS, PAYMENT_METHOD_ICONS } from '../constants';

export default function QuickAddModal({ orderId, onClose }) {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('現金');
  const amountInputRef = useRef(null);

  // 1. 撈取日常記帳標籤 (category === 'general')
  const generalTags = useLiveQuery(async () => {
    if (!db.custom_tags) return [];
    return await db.custom_tags.where({ category: 'general' }).sortBy('sort_order');
  }) || [];

  // 2. 如果是編輯模式，撈取特定訂單資料
  const order = useLiveQuery(async () => {
    if (!orderId) return null;
    return await db.orders.get(orderId);
  }, [orderId]);

  // 當 order 載入後，預填資料
  useEffect(() => {
    if (order) {
      setAmount(String(order.total_amount || ''));
      setTitle(order.title || '');
      setSelectedTag(order.tags && order.tags[0] ? order.tags[0] : '');
      setPaymentMethod(order.payment_method || '現金');
    } else {
      // 新增模式，預設清空
      setAmount('');
      setTitle('');
      setSelectedTag('');
      setPaymentMethod('現金');
    }
  }, [order, orderId]);

  // 當 defaultTags 載入時，若是新增模式且未選標籤，預設選擇第一個
  useEffect(() => {
    if (!orderId && generalTags.length > 0 && !selectedTag) {
      setSelectedTag(generalTags[0].name);
    }
  }, [generalTags, orderId, selectedTag]);

  // 自動 focus 金額輸入框
  useEffect(() => {
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  }, []);

  // 震動回饋
  const triggerVibration = () => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (e) {
        console.warn('震動回饋不被瀏覽器支援或受安全政策限制');
      }
    }
  };

  // 儲存邏輯 (新增或更新)
  const handleSave = async (e) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('請輸入有效的金額');
      return;
    }

    try {
      const tagList = selectedTag ? [selectedTag] : [];
      
      if (orderId) {
        // 編輯更新模式
        await db.orders.update(orderId, {
          title: title.trim(),
          total_amount: numericAmount,
          tags: tagList,
          payment_method: paymentMethod || '現金',
          updated_at: new Date().toISOString()
        });
      } else {
        // 新增模式
        await db.orders.add({
          title: title.trim() || `${selectedTag || '日常'}支出`,
          total_amount: numericAmount,
          currency: 'TWD',
          exchange_rate: 1,
          status: 'completed', // 日常記帳預設直接完成
          tags: tagList,
          order_type: 'daily',
          payment_method: paymentMethod || '現金',
          created_at: new Date().toISOString()
        });
      }

      triggerVibration();
      onClose();
    } catch (err) {
      console.error('儲存記帳失敗:', err);
      alert('儲存失敗，請重試');
    }
  };

  // 刪除邏輯
  const handleDelete = async () => {
    if (!orderId) return;
    if (!window.confirm('確定要刪除這筆生活記帳嗎？')) return;

    try {
      await db.orders.delete(orderId);
      triggerVibration();
      onClose();
    } catch (err) {
      console.error('刪除記帳失敗:', err);
      alert('刪除失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200">

      {/* 彈窗主體 */}
      <div className="bg-white dark:bg-gray-900 w-full rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative h-full md:h-auto max-h-[90vh] md:max-w-md flex flex-col border-4 border-black mx-auto z-10 transition-colors">
        
        {/* 頂部 Header */}
        <header className="flex justify-between items-center px-5 py-4 border-b-4 border-black bg-[#FFE66D] text-black shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-black text-white border border-black shrink-0">
              <Zap size={16} strokeWidth={3} />
            </span>
            <h2 className="text-base font-black uppercase tracking-wider">
              {orderId ? '編輯生活記帳' : '極簡生活記帳'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {orderId && (
              <button 
                onClick={handleDelete}
                className="p-1.5 bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer"
                title="刪除這筆記帳"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        {/* 表單內容 */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto bg-[#f7f1df] dark:bg-gray-800">
          
          {/* 金額框 */}
          <div className="flex flex-col items-center justify-center space-y-2 py-4 bg-white dark:bg-gray-900 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-xs font-black uppercase text-black dark:text-white tracking-wider">NT$ 記帳金額</span>
            <div className="flex items-baseline justify-center w-full max-w-xs">
              <span className="text-2xl font-black text-black dark:text-white mr-1 select-none">NT$</span>
              <input
                ref={amountInputRef}
                type="number"
                pattern="[0-9]*"
                inputMode="numeric"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full text-center text-5xl md:text-6xl font-black bg-transparent border-none outline-none text-black dark:text-white transition-colors font-mono placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* 名稱 / 備註輸入 */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-black dark:text-white tracking-wider">消費名稱 / 備註</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：午餐、高鐵票、飲料..."
              className="w-full bg-white dark:bg-gray-900 border-4 border-black rounded-none px-4 py-2.5 text-sm font-mono font-bold text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none placeholder:text-gray-400"
            />
          </div>

          {/* 快速標籤選擇 */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-black dark:text-white tracking-wider">選擇分類標籤</label>
            <div 
              className="flex gap-2 overflow-x-auto py-1 -mx-6 px-6"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {generalTags.map((tag) => {
                const isSelected = selectedTag === tag.name;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? '' : tag.name)}
                    className={`px-4 py-2 rounded-none text-xs font-black whitespace-nowrap transition-all border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFE66D] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white dark:bg-gray-700 text-black dark:text-white hover:bg-gray-100'
                    }`}
                  >
                    #{tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 支付方式切換按鈕 */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-black dark:text-white tracking-wider">支付方式</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 rounded-none text-[10px] font-black text-center whitespace-nowrap transition-all border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#4ECDC4] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white dark:bg-gray-700 text-black dark:text-white hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base leading-none">{PAYMENT_METHOD_ICONS[method]}</span>
                    <span className="scale-90 origin-center font-bold">{method}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 底部送出按鈕 */}
          <div className="pt-2 pb-safe">
            <button
              type="submit"
              className="w-full bg-[#FF6B6B] hover:bg-red-500 text-white font-black text-base py-3.5 px-6 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Check size={20} strokeWidth={3} />
              <span>{orderId ? '儲存更新' : '確認快速記帳'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
