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
    <div 
      className="fixed inset-0 z-[100] bg-gray-950/60 dark:bg-black/75 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
    >

      {/* 彈窗主體 (底部彈出層 Bottom Sheet / 電腦版置中卡片) */}
      <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 relative h-full md:h-auto max-h-[90vh] md:max-w-md flex flex-col border-t md:border border-gray-100 dark:border-gray-800/80 mx-auto z-10 transition-colors">
        
        {/* 頂部把手與關閉按鈕 */}
        <header className="flex justify-between items-center px-5 py-4 border-b border-gray-50 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="p-1 bg-amber-100 dark:bg-amber-950/40 text-amber-500 rounded-lg">
              <Zap size={16} className="fill-amber-500" />
            </span>
            <h2 className="text-base font-black text-gray-850 dark:text-gray-100">
              {orderId ? '編輯生活記帳' : '極簡生活記帳'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {orderId && (
              <button 
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="刪除這筆記帳"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* 表單內容 */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto">
          
          {/* 金額置中超大輸入框 */}
          <div className="flex flex-col items-center justify-center space-y-2 py-4">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-wider">NT$ 金額</span>
            <div className="flex items-baseline justify-center w-full max-w-xs relative">
              <span className="text-2xl font-black text-gray-400 dark:text-gray-500 mr-1 select-none">NT$</span>
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
                className="w-full text-center text-5xl md:text-6xl font-black bg-transparent border-none outline-none focus:ring-0 text-primary-dark dark:text-primary transition-colors placeholder:text-gray-200 dark:placeholder:text-gray-800 font-mono"
              />
            </div>
            {/* 裝飾底線 */}
            <div className="w-48 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full mt-2"></div>
          </div>

          {/* 名稱 / 備註輸入 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">消費名稱 / 備註</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="午餐、高鐵票、飲料..."
              className="w-full bg-gray-50 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700/80 rounded-2xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all font-medium"
            />
          </div>

          {/* 快速標籤選擇 (橫向滾動) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">選擇分類標籤</label>
            <div 
              className="flex gap-2 overflow-x-auto py-1 -mx-6 px-6 scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {generalTags.map((tag) => {
                const isSelected = selectedTag === tag.name;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? '' : tag.name)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shadow-sm active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-white shadow-primary/20 ring-2 ring-primary-light'
                        : 'bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-150/45 dark:border-gray-700/30'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 支付方式切換按鈕 */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">支付方式</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 rounded-xl text-[10px] font-black text-center whitespace-nowrap transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-primary text-white shadow-primary/20 ring-1 ring-primary-light'
                        : 'bg-gray-50 dark:bg-gray-850/80 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-150/45 dark:border-gray-700/30'
                    }`}
                  >
                    <span className="text-base leading-none">{PAYMENT_METHOD_ICONS[method]}</span>
                    <span className="scale-90 origin-center">{method}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 底部送出按鈕 */}
          <div className="pt-4 pb-safe">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98]"
            >
              <Check size={18} strokeWidth={2.5} />
              <span>{orderId ? '儲存更新' : '確認快速記帳'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
