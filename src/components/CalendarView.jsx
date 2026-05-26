import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CURRENCIES, STATUS_COLORS, getStatusStyle } from '../constants';
import { ChevronLeft, ChevronRight, ShoppingBag, DollarSign, Calendar, Info } from 'lucide-react';

export default function CalendarView({ onOrderClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 撈取資料庫資料
  const orders = useLiveQuery(() => db.orders.toArray());
  const sales = useLiveQuery(() => db.sales.toArray());
  const items = useLiveQuery(() => db.items.toArray());

  if (orders === undefined || sales === undefined || items === undefined) {
    return (
      <div className="p-4 h-full flex items-center justify-center text-gray-400 dark:text-gray-500 font-medium transition-colors">
        載入日曆數據中...
      </div>
    );
  }

  // 建立物品的 ID 對照表
  const itemsMap = {};
  items.forEach(item => {
    itemsMap[item.id] = item;
  });

  // 日期格式化輔助函數 YYYY-MM-DD
  const getLocalDateString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStringHelper(d)}`;
  };

  function dayStringHelper(d) {
    return d;
  }

  // 轉換 ISO 字串為本地 YYYY-MM-DD 格式
  const parseIsoToLocalDateString = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 分組訂單與售出紀錄
  const ordersByDate = {};
  const salesByDate = {};

  orders.forEach(order => {
    const dateStr = parseIsoToLocalDateString(order.created_at);
    if (dateStr) {
      if (!ordersByDate[dateStr]) ordersByDate[dateStr] = [];
      ordersByDate[dateStr].push(order);
    }
  });

  sales.forEach(sale => {
    const dateStr = parseIsoToLocalDateString(sale.created_at);
    if (dateStr) {
      if (!salesByDate[dateStr]) salesByDate[dateStr] = [];
      salesByDate[dateStr].push(sale);
    }
  });

  // 計算日曆網格
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const daysArray = [];

  // 上個月的剩餘天數
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const cellDate = new Date(year, month - 1, dayNum);
    daysArray.push({
      day: dayNum,
      isCurrentMonth: false,
      date: cellDate,
      dateStr: getLocalDateString(cellDate)
    });
  }

  // 當月天數
  for (let i = 1; i <= daysInMonth; i++) {
    const cellDate = new Date(year, month, i);
    daysArray.push({
      day: i,
      isCurrentMonth: true,
      date: cellDate,
      dateStr: getLocalDateString(cellDate)
    });
  }

  // 下個月的補齊天數
  const totalCells = 42; // 6 rows * 7 days
  const nextMonthNeeded = totalCells - daysArray.length;
  for (let i = 1; i <= nextMonthNeeded; i++) {
    const cellDate = new Date(year, month + 1, i);
    daysArray.push({
      day: i,
      isCurrentMonth: false,
      date: cellDate,
      dateStr: getLocalDateString(cellDate)
    });
  }

  // 切換月份
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 取得選中日期的明細
  const selectedDateStr = getLocalDateString(selectedDate);
  const selectedDateOrders = ordersByDate[selectedDateStr] || [];
  const selectedDateSales = salesByDate[selectedDateStr] || [];
  const hasRecords = selectedDateOrders.length > 0 || selectedDateSales.length > 0;

  // 週首字母
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="space-y-4 pb-32">
      {/* 日曆主卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/80 transition-colors">
        {/* 月份切換標頭 */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-150">
            {year} 年 {month + 1} 月
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDate(today);
              }}
              className="text-xs font-semibold px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-primary-dark dark:text-primary transition-colors"
            >
              今天
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 星期標頭 */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {weekdays.map((wd, index) => (
            <span
              key={wd}
              className={`text-xs font-bold py-1 ${
                index === 0 ? 'text-red-400' : index === 6 ? 'text-primary-dark dark:text-primary-light' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {wd}
            </span>
          ))}
        </div>

        {/* 日曆格子 */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysArray.map((cell, idx) => {
            const isSelected = selectedDateStr === cell.dateStr;
            const isToday = getLocalDateString(new Date()) === cell.dateStr;
            
            const cellOrders = ordersByDate[cell.dateStr] || [];
            const cellSales = salesByDate[cell.dateStr] || [];
            
            const hasOrder = cellOrders.length > 0;
            const hasSale = cellSales.length > 0;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(cell.date)}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-1.5 relative transition-all active:scale-95 ${
                  cell.isCurrentMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'
                } ${
                  isSelected 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : isToday 
                    ? 'bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary ring-1 ring-primary/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {/* 日期數字 */}
                <span className="text-xs font-bold mt-0.5">{cell.day}</span>
                
                {/* 紅綠圓點 */}
                <div className="flex gap-1 mb-0.5">
                  {hasOrder && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`} />
                  )}
                  {hasSale && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-secondary'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選中日期收支明細 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-1.5">
            <Calendar size={16} className="text-primary-dark dark:text-primary" />
            <span>
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 明細
            </span>
          </h3>
        </div>

        {!hasRecords ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 border-dashed p-8 text-center flex flex-col items-center transition-colors">
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700/50 rounded-full flex justify-center items-center mb-2.5 text-gray-300 dark:text-gray-500">
              <Info size={22} />
            </div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">此日無收支紀錄</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* 訂單支出 */}
            {selectedDateOrders.map(order => {
              const curr = CURRENCIES.find(c => c.code === order.currency);
              const symbol = curr ? curr.symbol : (order.exchange_rate === 5.5 || order.exchange_rate === 0.23 ? '¥' : '$');
              const totalCostNTD = Math.round(order.total_amount * order.exchange_rate + (Number(order.global_shipping_fee) || 0));

              return (
                <div
                  key={order.id}
                  onClick={() => onOrderClick && onOrderClick(order.id)}
                  className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex justify-between items-center hover:shadow-md dark:hover:bg-gray-750 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug">{order.source}</h4>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-0.5">
                        外幣: {symbol}{order.total_amount} (匯率: {order.exchange_rate})
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-red-500 dark:text-red-400 text-sm">-NT$ {totalCostNTD.toLocaleString()}</div>
                    {(() => {
                      const statusInfo = getStatusStyle(order.status);
                      return (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 scale-90 origin-right whitespace-nowrap shadow-sm ${statusInfo.color}`}
                        >
                          {statusInfo.dot} {statusInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {/* 回血收入 */}
            {selectedDateSales.map(sale => {
              const item = itemsMap[sale.item_id];
              return (
                <div
                  key={sale.id}
                  className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 flex justify-between items-center transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-secondary-light/40 dark:bg-secondary-dark/20 text-secondary-dark dark:text-secondary flex items-center justify-center shrink-0">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug">
                        {item ? item.name : '未知物品'}
                      </h4>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-0.5">
                        售出數量: {sale.quantity} 件 {sale.buyer_id ? `| 買家: ${sale.buyer_id}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-secondary-dark dark:text-secondary text-sm">+NT$ {sale.price.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
