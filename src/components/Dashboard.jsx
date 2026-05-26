import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getDeadlineInfo } from '../utils';

export default function Dashboard({ onQuickAdd, onOrderClick }) {
  // 1. 新增狀態來管理當前檢視的月份，預設為當前時間
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // 撈取所有訂單、物品與售出紀錄
  const orders = useLiveQuery(() => db.orders.toArray());
  const items = useLiveQuery(() => db.items.toArray());
  const sales = useLiveQuery(() => db.sales.toArray());

  // 若資料還沒載入，顯示友善的載入畫面
  if (orders === undefined || items === undefined || sales === undefined) {
    return <div className="p-4 h-full flex items-center justify-center text-gray-400 font-medium">載入數據中...</div>;
  }

  // 月份切換輔助函式
  const handlePrevMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleMonthInput = (e) => {
    if (!e.target.value) return;
    const [year, month] = e.target.value.split('-');
    setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
  };

  // 取得當前選取月份的 YYYY-MM 字串格式
  const targetYearMonth = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  // 2. 實作數據按月過濾邏輯
  const monthlyOrders = orders.filter(o => o.created_at && o.created_at.slice(0, 7) === targetYearMonth);
  const monthlySales = sales.filter(s => s.created_at && s.created_at.slice(0, 7) === targetYearMonth);

  // 建立訂單匯率的快速對照表 (Order ID -> Exchange Rate) (歷史所有訂單)
  const orderRates = {};
  orders.forEach(order => {
    orderRates[order.id] = order.exchange_rate;
  });

  // 計算：本月支出 (優先使用新欄位 total_amount_twd，相容舊資料)
  const monthlyTotalExpense = monthlyOrders.reduce((sum, order) => {
    return sum + (order.total_amount_twd !== undefined 
      ? order.total_amount_twd 
      : (order.total_amount * (order.exchange_rate || 1)));
  }, 0);

  // 輔助計算: 所有物品的原始台幣總成本 (全局累計)
  const totalItemsCost = items.reduce((sum, item) => {
    const rate = orderRates[item.order_id] || 1;
    return sum + (item.price * item.quantity * rate);
  }, 0);

  // 計算：本月收入 (僅計算當月 sales)
  const monthlyTotalIncome = monthlySales.reduce((sum, sale) => sum + Number(sale.price), 0);

  // 全局總收入 (全局累計)
  const totalIncome = sales.reduce((sum, sale) => sum + Number(sale.price), 0);

  // 計算：自留資產淨值 (歷史所有物品原始台幣總成本 - 歷史總收入)
  const netAssetValue = Math.max(0, totalItemsCost - totalIncome);

  // 計算：未回款 (目前暫時寫死 0)
  const pendingReturn = 0;

  // 輔助函式：格式化金額為 NT$ 1,000
  const formatMoney = (amount) => {
    return `NT$ ${Math.round(amount).toLocaleString()}`;
  };

  // 篩選有繳費期限且為「已喊單」狀態的訂單，並依剩餘天數排序 (待繳費通知保持全局，不受選定月份限制)
  const unpaidOrders = orders
    .filter(o => o.status === '已喊單' && o.payment_deadline)
    .map(o => ({
      ...o,
      deadlineInfo: getDeadlineInfo(o.payment_deadline)
    }))
    .sort((a, b) => {
      const aDays = a.deadlineInfo.type === 'overdue' ? -a.deadlineInfo.days : a.deadlineInfo.days;
      const bDays = b.deadlineInfo.type === 'overdue' ? -b.deadlineInfo.days : b.deadlineInfo.days;
      return aDays - bDays;
    });

  // 按時間倒序排列的當月新增訂單與記帳清單
  const sortedMonthlyOrders = [...monthlyOrders].sort((a, b) => 
    (b.created_at || '').localeCompare(a.created_at || '')
  );

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto pb-32">
      {/* 標題與月份區塊 */}
      <header className="flex justify-between items-end mt-2 px-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">總覽</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">本月資產與回血追蹤</p>
        </div>
      </header>

      {/* 頂部數據與切換區 - 電腦版 3 欄佈局，手機版維持垂直排列 */}
      <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
        {/* 月份切換器 (Month Selector) */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700/80 shadow-sm transition-colors duration-200 md:order-1">
          <button 
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors font-black select-none text-base"
          >
            &lt;
          </button>
          <div className="relative flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity py-1 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm select-none tracking-wide">
              {selectedMonth.getFullYear()} 年 {selectedMonth.getMonth() + 1} 月
            </span>
            <input 
              type="month" 
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={handleMonthInput}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="text-xs text-gray-400">📅</span>
          </div>
          <button 
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors font-black select-none text-base"
          >
            &gt;
          </button>
        </div>

        {/* 核心數據區塊 (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-3 md:contents">
          {/* 本月支出 */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between transition-colors md:order-2">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mb-1">本月支出 (Monthly Expense)</span>
            <span className="text-xl font-bold text-primary-dark dark:text-primary mt-1">{formatMoney(monthlyTotalExpense)}</span>
          </div>
          
          {/* 本月收入 (已回血) */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between transition-colors md:order-3">
            <span className="text-[11px] text-secondary-dark dark:text-secondary font-bold mb-1">本月收入 (Monthly Income)</span>
            <span className="text-xl font-bold text-secondary-dark dark:text-secondary mt-1">{formatMoney(monthlyTotalIncome)}</span>
          </div>

          {/* 未回款 */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex flex-col justify-between transition-colors md:order-5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mb-1">未回款 (Pending Return)</span>
            <span className="text-xl font-bold text-amber-500 dark:text-amber-400 mt-1">{formatMoney(pendingReturn)}</span>
          </div>

          {/* 自留資產淨值 - 使用特別的漸層底色強調重點 (歷史累計) */}
          <div className="bg-gradient-to-br from-primary to-primary-dark p-4 rounded-2xl shadow-sm border border-transparent flex flex-col justify-between text-white shadow-primary/20 transition-all md:order-6">
            <span className="text-[11px] text-primary-light font-semibold mb-1">自留資產 (Net Asset)</span>
            <span className="text-xl font-bold mt-1">{formatMoney(netAssetValue)}</span>
          </div>
        </div>

        {/* ⚡ 快速記帳按鈕 */}
        <button 
          onClick={onQuickAdd}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-4 px-4 rounded-2xl shadow-md shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 select-none md:order-4 md:py-0 md:h-full"
        >
          <span className="text-base">⚡</span>
          <span className="text-sm tracking-wide">極簡生活記帳 (Quick Add)</span>
        </button>
      </div>

      {/* 下方清單與提醒區 - 大螢幕左右並排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ⏳ 待繳費提醒通知區塊 */}
        {unpaidOrders.length > 0 && (
          <section className="px-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span>⏳</span> 待繳費提醒
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full">
                {unpaidOrders.length} 筆待辦
              </span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {unpaidOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => onOrderClick && onOrderClick(order.id)}
                  className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex items-center justify-between transition-all hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate font-sans">
                      {order.title || order.source}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-semibold truncate">
                      來源：{order.source} | 繳費期限: {order.payment_deadline}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black shrink-0 ${order.deadlineInfo.colorClass}`}>
                    {order.deadlineInfo.text}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 本月新增紀錄 */}
        <section className={`px-1 ${unpaidOrders.length === 0 ? 'md:col-span-2' : ''}`}>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-3">本月新增紀錄</h2>
          {sortedMonthlyOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-6 flex flex-col items-center justify-center text-center h-40 transition-colors">
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700/40 rounded-full flex items-center justify-center mb-3">
                <span className="text-xl">📭</span>
              </div>
              <p className="text-sm font-medium text-gray-400 dark:text-gray-400">本月尚無任何紀錄</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">當月新增的訂單與日常記帳會顯示在這裡</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {sortedMonthlyOrders.map(order => {
                const isDaily = order.order_type === 'daily';
                const displayTitle = order.title || (isDaily ? '日常支出' : order.source);
                const amountTWD = order.total_amount_twd !== undefined 
                  ? order.total_amount_twd 
                  : Math.round(order.total_amount * (order.exchange_rate || 1));
                const dateStr = order.created_at ? order.created_at.slice(5, 10).replace('-', '/') : ''; // MM/DD
                
                return (
                  <div
                    key={order.id}
                    onClick={() => onOrderClick && onOrderClick(order.id)}
                    className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex items-center justify-between transition-all hover:shadow-md active:scale-[0.98] cursor-pointer"
                  >
                    <div className="min-w-0 pr-2 flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isDaily ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-500' : 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light'
                      }`}>
                        {isDaily ? '⚡' : '📦'}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                          {displayTitle}
                        </h3>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-semibold truncate">
                          {isDaily ? '日常記帳' : `來源：${order.source}`} {order.tags && order.tags.length > 0 && `| ${order.tags.join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-150">
                        NT$ {amountTWD.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                        {dateStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

