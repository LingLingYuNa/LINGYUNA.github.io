import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CURRENCIES, STATUS_COLORS, DEFAULT_TAGS, ORDER_STATUSES, PAYMENT_METHODS } from '../constants';
import { calculateOrderTotalTWD } from '../utils';

export default function AddOrder({ existingOrder, onClose }) {
  const [title, setTitle] = useState(existingOrder?.title || existingOrder?.source || '');
  const [source, setSource] = useState(existingOrder?.source || '');
  const [amount, setAmount] = useState(existingOrder?.total_amount || '');
  const [currency, setCurrency] = useState(existingOrder?.currency || CURRENCIES[0].code);
  const [exchangeRate, setExchangeRate] = useState(existingOrder?.exchange_rate || CURRENCIES[0].defaultRate);
  const [status, setStatus] = useState(existingOrder?.status || '已喊單');
  const [trackingNumber, setTrackingNumber] = useState(existingOrder?.tracking_number || '');
  const [paymentDeadline, setPaymentDeadline] = useState(existingOrder?.payment_deadline || '');
  const [tagCategory, setTagCategory] = useState(existingOrder?.tag_category || 'general');
  const [selectedTags, setSelectedTags] = useState(existingOrder?.tags || []);
  const [focusedField, setFocusedField] = useState(null); // 'title' | 'source' | null
  const [isSaving, setIsSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(existingOrder?.payment_method || (existingOrder?.tag_category === 'general' ? '現金' : 'ATM/轉帳'));
  
  // 進階費用與折扣狀態
  const [handlingFeePercent, setHandlingFeePercent] = useState(existingOrder?.handling_fee_percent || 0);
  const [serviceFeePercent, setServiceFeePercent] = useState(existingOrder?.service_fee_percent || 0);
  const [shippingFee, setShippingFee] = useState(existingOrder?.shipping_fee || existingOrder?.global_shipping_fee || 0);
  const [discountAmount, setDiscountAmount] = useState(existingOrder?.discount_amount || existingOrder?.discount || 0);


  // 歷史數據用來做關聯建議
  const allOrders = useLiveQuery(() => db.orders.toArray()) || [];
  const uniqueTitles = Array.from(new Set(allOrders.map(o => o.title).filter(Boolean))).slice(0, 15);
  const uniqueSources = Array.from(new Set(allOrders.map(o => o.source).filter(Boolean))).slice(0, 15);

  // 讀取 IndexedDB 的自訂標籤，若未載入完成或為空則使用預設標籤做後備
  const customTags = useLiveQuery(() => db.custom_tags.orderBy('sort_order').toArray()) || [];
  const activeTags = customTags.length > 0 
    ? customTags.filter(t => t.category === tagCategory)
    : (tagCategory === 'anime' ? DEFAULT_TAGS.map((name, i) => ({ id: i, name, category: 'anime' })) : []);

  // 取得當前訂單的子物品
  const currentItems = useLiveQuery(
    () => existingOrder ? db.items.where({ order_id: existingOrder.id }).toArray() : Promise.resolve([]),
    [existingOrder]
  ) || [];

  // 計算週邊訂單的外幣總金額
  const calculatedAmount = currentItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  const handleCurrencyChange = (e) => {
    const newCode = e.target.value;
    setCurrency(newCode);
    const curr = CURRENCIES.find(c => c.code === newCode);
    if (curr) {
      setExchangeRate(curr.defaultRate);
    }
  };

  const toggleTag = (tagName) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || !source || (tagCategory !== 'anime' && !amount)) return;

    setIsSaving(true);
    try {
      const orderData = {
        title,
        source,
        total_amount: tagCategory === 'anime' ? calculatedAmount : Number(amount),
        currency,
        exchange_rate: Number(exchangeRate),
        status,
        tag_category: tagCategory,
        tags: selectedTags,
        tracking_number: trackingNumber,
        payment_deadline: paymentDeadline || null,
        payment_method: paymentMethod || (tagCategory === 'general' ? '現金' : 'ATM/轉帳'),
        handling_fee_percent: Number(handlingFeePercent) || 0,
        service_fee_percent: Number(serviceFeePercent) || 0,
        shipping_fee: Number(shippingFee) || 0,
        discount_amount: Number(discountAmount) || 0,
      };

      // 取得子物品（如果是編輯模式的話）
      let dbItems = [];
      if (existingOrder) {
        dbItems = await db.items.where({ order_id: existingOrder.id }).toArray();
      }

      // 計算最終台幣總計
      orderData.total_amount_twd = calculateOrderTotalTWD(orderData, dbItems);

      if (existingOrder) {
        await db.orders.update(existingOrder.id, orderData);
      } else {
        await db.orders.add({
          ...orderData,
          created_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error) {
      console.error('寫入失敗:', error);
      alert('寫入資料失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // 全螢幕彈出層 (Mobile-First) + 電腦版置中卡片
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 md:bg-gray-950/60 md:backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-gray-900 w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {existingOrder ? '編輯訂單' : '新增訂單紀錄'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* 訂單名稱 + 聯想詞彙 */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">訂單名稱</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setTimeout(() => setFocusedField(null), 250)}
              placeholder="例如：徽章盒裝、角色立牌、隨機拍立得..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {focusedField === 'title' && uniqueTitles.length > 0 && (
              <div className="mt-1 space-y-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold block">歷史常填名稱：</span>
                <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
                  {uniqueTitles.map(t => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={() => setTitle(t)}
                      className="px-2.5 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-medium transition-colors shrink-0"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 購買來源 + 聯想詞彙 */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">購買來源</label>
            <input
              type="text"
              required
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onFocus={() => setFocusedField('source')}
              onBlur={() => setTimeout(() => setFocusedField(null), 250)}
              placeholder="例如：煤爐、駿河屋、淘寶、安利美特..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            {focusedField === 'source' && uniqueSources.length > 0 && (
              <div className="mt-1 space-y-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold block">歷史常填來源：</span>
                <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
                  {uniqueSources.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => setSource(s)}
                      className="px-2.5 py-1 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full font-medium transition-colors shrink-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 訂單分類標籤雙軌選擇器 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">訂單標籤</label>
            {/* 切換大分類 */}
            <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl transition-colors">
              <button
                type="button"
                onClick={() => {
                  setTagCategory('general');
                  setSelectedTags([]);
                  if (!existingOrder) {
                    setPaymentMethod('現金');
                  }
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tagCategory === 'general'
                    ? 'bg-white dark:bg-gray-700 text-primary-dark dark:text-primary-light shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                一般生活記帳
              </button>
              <button
                type="button"
                onClick={() => {
                  setTagCategory('anime');
                  setSelectedTags([]);
                  if (!existingOrder) {
                    setPaymentMethod('ATM/轉帳');
                  }
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  tagCategory === 'anime'
                    ? 'bg-white dark:bg-gray-700 text-primary-dark dark:text-primary-light shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                二次元週邊
              </button>
            </div>

            {/* 標籤徽章清單 */}
            <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto pr-1">
              {activeTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.id || tag.name}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary border-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {activeTags.length === 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic px-1">尚未建立此分類的自訂標籤。</span>
              )}
            </div>
          </div>

          {/* 外幣總金額 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">外幣總金額</label>
            <input
              type="number"
              required={tagCategory !== 'anime'}
              step="0.01"
              value={tagCategory === 'anime' ? calculatedAmount : amount}
              onChange={tagCategory === 'anime' ? undefined : (e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={tagCategory === 'anime'}
              placeholder={tagCategory === 'anime' ? "由物品自動計算" : "請輸入金額"}
              className={`w-full border rounded-xl px-4 py-3 text-sm transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                tagCategory === 'anime'
                  ? 'bg-gray-100 dark:bg-gray-850 border-gray-200 dark:border-gray-705 cursor-not-allowed text-gray-400 dark:text-gray-500'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
              }`}
            />
            {tagCategory === 'anime' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-1">
                💡 總金額將由物品清單自動計算
              </p>
            )}
          </div>

          {/* 幣別與匯率 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 幣別 */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">幣別</label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={handleCurrencyChange}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none text-gray-800 dark:text-gray-100"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 當下匯率 */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">當下匯率</label>
              <input
                type="number"
                required
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* 訂單狀態 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">當前狀態</label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none text-gray-800 dark:text-gray-100"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.dot} {s.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 支付方式 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">支付方式</label>
            <div className="relative">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none text-gray-800 dark:text-gray-100"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 繳費期限 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">繳費期限 (選填)</label>
            <input
              type="date"
              value={paymentDeadline}
              onChange={(e) => setPaymentDeadline(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 物流單號 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">物流單號</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="請輸入物流單號 (選填)"
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 進階費用與折扣 (選填) */}
          <div className="border border-gray-250/60 dark:border-gray-750/80 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-800/30 space-y-4 transition-colors">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              進階費用與折扣 (選填)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* 手續費 (%) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">手續費 (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={handlingFeePercent || ''}
                  placeholder="0"
                  onChange={(e) => setHandlingFeePercent(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
              
              {/* 服務費 (%) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">服務費 (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={serviceFeePercent || ''}
                  placeholder="0"
                  onChange={(e) => setServiceFeePercent(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 運費 (台幣) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">運費 (台幣)</label>
                <input
                  type="number"
                  min="0"
                  value={shippingFee || ''}
                  placeholder="0"
                  onChange={(e) => setShippingFee(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>

              {/* 折扣 (台幣) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">折扣 (台幣)</label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  placeholder="0"
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer 按鈕 */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] transition-colors">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-650 active:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !title || !source || (tagCategory !== 'anime' && !amount)}
            className="flex-1 py-3.5 px-4 bg-primary text-white rounded-xl font-semibold shadow-sm shadow-primary/30 hover:bg-primary-dark active:bg-primary-dark transition-colors disabled:opacity-50 disabled:shadow-none"
          >
            {isSaving ? '儲存中...' : (existingOrder ? '儲存變更' : '儲存')}
          </button>
        </div>
      </div>
    </div>
  );
}
