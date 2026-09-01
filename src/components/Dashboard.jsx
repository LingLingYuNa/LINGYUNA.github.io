import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getDeadlineInfo } from '../utils';
import { requestAuth, uploadBackup, downloadBackup, disconnectGoogleDrive } from '../utils/googleDriveSync';
import { Cloud, RefreshCw, LogOut, Zap, Package, Inbox } from 'lucide-react';

export default function Dashboard({ onOrderClick }) {
  // 1. 新增狀態來管理當前檢視的月份，預設為當前時間
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // 雲端同步連結狀態
  const [isLinked, setIsLinked] = useState(() => localStorage.getItem('google_drive_linked') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);

  // 連結 Google 帳號並自動完成首次雲端同步備份或還原
  const handleConnect = async () => {
    setIsSyncing(true);
    try {
      await requestAuth(true);
      setIsLinked(true);
      localStorage.setItem('google_drive_auto_sync', 'true'); // 連結後預設開啟自動同步

      // 1. 嘗試載入雲端是否有已存在的備份檔
      const backupData = await downloadBackup();
      
      const ordersData = await db.orders.toArray();
      const itemsData = await db.items.toArray();
      const salesData = await db.sales.toArray();
      const customTagsData = db.custom_tags ? await db.custom_tags.toArray() : [];

      const localOrdersCount = ordersData.length;
      const localItemsCount = itemsData.length;

      if (backupData && backupData.data) {
        // 雲端已有備份檔案！
        const { data, export_date } = backupData;
        const salesList = data.sales || [];
        const customTagsList = data.custom_tags || [];

        if (localOrdersCount === 0 && localItemsCount === 0) {
          // A. 本地資料為空 -> 執行靜默自動還原
          await db.transaction('rw', db.orders, db.items, db.sales, db.custom_tags, async () => {
            if (data.orders && data.orders.length > 0) await db.orders.bulkPut(data.orders);
            if (data.items && data.items.length > 0) await db.items.bulkPut(data.items);
            if (salesList.length > 0) await db.sales.bulkPut(salesList);
            if (customTagsList.length > 0) await db.custom_tags.bulkPut(customTagsList);
          });
          localStorage.setItem('last_local_update', export_date || new Date().toISOString());
          alert('已自動從 Google Drive 下載並還原您的全部記帳與標籤資料！');
          window.location.reload();
          return;
        } else {
          // B. 本地有資料 -> 彈出提示詢問使用者要由雲端覆蓋，還是本地覆蓋雲端
          const confirmRestore = window.confirm(
            `雲端同步提示\n\n偵測到您在 Google 雲端硬碟已有備份資料（更新時間：${new Date(export_date).toLocaleString('zh-TW')}）。\n\n【確定】：載入雲端資料並覆蓋此裝置的本地資料。\n【取消】：保留本地資料，並以本地資料覆蓋雲端備份。`
          );

          if (confirmRestore) {
            // 還原雲端覆蓋本地
            await db.transaction('rw', db.orders, db.items, db.sales, db.custom_tags, async () => {
              await db.orders.clear();
              await db.items.clear();
              await db.sales.clear();
              await db.custom_tags.clear();
              if (data.orders && data.orders.length > 0) await db.orders.bulkPut(data.orders);
              if (data.items && data.items.length > 0) await db.items.bulkPut(data.items);
              if (salesList.length > 0) await db.sales.bulkPut(salesList);
              if (customTagsList.length > 0) await db.custom_tags.bulkPut(customTagsList);
            });
            localStorage.setItem('last_local_update', export_date || new Date().toISOString());
            alert('已成功載入雲端備份並覆蓋本地資料！');
            window.location.reload();
            return;
          } else {
            // 本地覆蓋雲端
            const newBackup = {
              version: 3,
              export_date: new Date().toISOString(),
              data: { orders: ordersData, items: itemsData, sales: salesData, custom_tags: customTagsData }
            };
            await uploadBackup(newBackup);
            localStorage.setItem('last_local_update', newBackup.export_date);
            alert('已使用本地資料覆蓋雲端備份檔案！');
          }
        }
      } else {
        // 雲端無備份檔 -> 直接建立備份上傳
        const newBackup = {
          version: 3,
          export_date: new Date().toISOString(),
          data: { orders: ordersData, items: itemsData, sales: salesData, custom_tags: customTagsData }
        };
        await uploadBackup(newBackup);
        localStorage.setItem('last_local_update', newBackup.export_date);
        alert('成功連結 Google 帳號！已為您建立雲端備份並完成首次同步。');
      }
    } catch (error) {
      console.error('連結雲端失敗:', error);
      alert('連結 Google 帳號失敗：\n' + (error.message || '授權被取消或發生錯誤'));
    } finally {
      setIsSyncing(false);
    }
  };

  // 解除連結雲端帳號
  const handleDisconnect = () => {
    if (window.confirm('確定要解除 Google 帳號的雲端同步連結嗎？這會清除本機的登入 Token，但不會刪除雲端硬碟的備份檔。')) {
      disconnectGoogleDrive();
      setIsLinked(false);
      localStorage.removeItem('google_drive_auto_sync');
      alert('已成功解除雲端同步連結。');
    }
  };

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
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white border-2 border-black shrink-0 overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:hidden">
              <img src="/logo.jpg" alt="CollectTrack Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-black uppercase text-black dark:text-white tracking-wider">總覽</h1>
            {isLinked ? (
              <span className="inline-flex items-center gap-1.5 text-xs bg-[#4ECDC4] text-black font-black px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                <span className="w-2 h-2 rounded-none bg-black animate-pulse"></span>
                雲端備份中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs bg-[#FFE66D] text-black font-black px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                <span className="w-2 h-2 rounded-none bg-black"></span>
                未同步備份
              </span>
            )}
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-mono font-bold">本月資產與回血追蹤 (COLLECTTRACK DASHBOARD)</p>
        </div>
      </header>

      {/* 雲端備份提醒橫幅 */}
      {!isLinked && (
        <div className="bg-[#FFE66D] text-black border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rotate-[-0.5deg]">
          <div className="flex items-start gap-3">
            
            <div>
              <h3 className="text-sm font-black uppercase text-black">未啟用雲端自動備份</h3>
              <p className="text-xs font-bold text-gray-800 mt-0.5">目前資料僅儲存在本機瀏覽器，清理快取或換手機可能導致資料遺失！</p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={isSyncing}
            className="self-start sm:self-center px-4 py-2.5 bg-[#FF6B6B] hover:bg-[#FF6B6B]/90 active:scale-95 disabled:opacity-50 text-white text-xs font-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <span>{isSyncing ? '連接中...' : '立即連結 GOOGLE 備份'}</span>
          </button>
        </div>
      )}

      {/* 頂部數據與切換區 - 月份長條置頂全寬，下方 3 欄金額統計框 */}
      <div className="space-y-4">
        {/* 1. 月份切換長條 (Full-Width Month Selector Bar) */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 px-4 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-200 w-full">
          <button 
            onClick={handlePrevMonth}
            className="w-10 h-10 flex items-center justify-center bg-[#FFE66D] border-2 border-black text-black font-black text-lg hover:translate-x-[-1px] active:translate-x-[1px] transition-all shrink-0 cursor-pointer"
            title="上個月"
          >
            &lt;
          </button>
          <div className="relative flex items-center justify-center cursor-pointer py-2 px-6 bg-[#4ECDC4]/20 border-2 border-black text-center min-w-0 flex-1">
            <span className="font-mono font-black text-black dark:text-white text-base md:text-lg tracking-wider text-center leading-none block w-full">
              {selectedMonth.getFullYear()} 年 {selectedMonth.getMonth() + 1} 月
            </span>
            <input 
              type="month" 
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={handleMonthInput}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <button 
            onClick={handleNextMonth}
            className="w-10 h-10 flex items-center justify-center bg-[#FFE66D] border-2 border-black text-black font-black text-lg hover:translate-x-[1px] active:translate-x-[-1px] transition-all shrink-0 cursor-pointer"
            title="下個月"
          >
            &gt;
          </button>
        </div>

        {/* 2. 金額統計框框 (3 大金額統計卡片) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 本月支出 */}
          <div className="bg-[#FF6B6B] text-black p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-0.5deg] flex flex-col justify-between">
            <span className="text-xs font-black uppercase tracking-wider mb-1">本月支出 (EXPENSE)</span>
            <span className="text-2xl font-black mt-1 font-mono">{formatMoney(monthlyTotalExpense)}</span>
          </div>
          
          {/* 本月收入 (已回血) */}
          <div className="bg-[#4ECDC4] text-black p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[0.5deg] flex flex-col justify-between">
            <span className="text-xs font-black uppercase tracking-wider mb-1">本月收入 (INCOME)</span>
            <span className="text-2xl font-black mt-1 font-mono">{formatMoney(monthlyTotalIncome)}</span>
          </div>

          {/* 自留資產淨值 (歷史累計) */}
          <div className="bg-[#95E1D3] text-black p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between transition-all">
            <span className="text-xs font-black uppercase tracking-wider mb-1">自留資產 (NET ASSET)</span>
            <span className="text-2xl font-black mt-1 font-mono">{formatMoney(netAssetValue)}</span>
          </div>
        </div>
      </div>

      {/* ⏳ 待繳費提醒通知區塊 (如有) */}
      {unpaidOrders.length > 0 && (
        <section className="px-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>⏳</span> 待繳費提醒
            </h2>
            <span className="text-xs font-black px-2.5 py-0.5 bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {unpaidOrders.length} 筆待辦
            </span>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {unpaidOrders.map(order => (
              <div
                key={order.id}
                onClick={() => onOrderClick && onOrderClick(order.id)}
                className="bg-white dark:bg-gray-800 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-black dark:text-white text-sm truncate uppercase">
                    {order.title || order.source}
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-mono font-bold truncate">
                    來源：{order.source} | 繳費期限: {order.payment_deadline}
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-[#FFE66D] text-black border-2 border-black font-black text-xs shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {order.deadlineInfo.text}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 雲端備份與同步狀態常駐區塊 */}
      <section className="px-1 space-y-3">
        <h2 className="text-base font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-1.5">
           雲端同步狀態
        </h2>
        <div className="bg-white dark:bg-gray-800 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-3 border-2 border-black shrink-0 ${isLinked ? 'bg-[#4ECDC4] text-black' : 'bg-gray-200 text-black'}`}>
                <Cloud size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-black dark:text-white uppercase truncate">
                  {isLinked ? 'GOOGLE 雲端已連結' : '未連結 GOOGLE 帳號'}
                </h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 font-mono font-bold">
                  {isLinked ? '已啟用防丟失背景 5 秒自動同步' : '資料僅保存在本機，清除快取恐遺失'}
                </p>
              </div>
            </div>
            
            {isLinked ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleConnect}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-[#FFE66D] hover:bg-[#FFE66D]/90 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-1 select-none cursor-pointer"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  <span>同步</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="p-1.5 bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center"
                  title="中斷連結"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isSyncing}
                className="px-4 py-2 bg-[#FF6B6B] text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer shrink-0 uppercase"
              >
                {isSyncing ? '連結中...' : '立即登入'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 全寬【本月新增紀錄】拉長顯示適應螢幕尺寸 */}
      <section className="px-1 space-y-3">
        <h2 className="text-base font-black text-black dark:text-white uppercase tracking-wider">本月新增紀錄</h2>
        {sortedMonthlyOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col items-center justify-center text-center h-48 transition-colors w-full">
            <div className="w-12 h-12 bg-[#FFE66D] border-2 border-black flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Inbox size={24} className="text-black" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-black text-black dark:text-white uppercase">本月尚無任何紀錄</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 font-mono mt-1 font-bold">當月新增的週邊訂單與明細會顯示在這裡</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 w-full">
            {sortedMonthlyOrders.map(order => {
              const displayTitle = order.title || order.source;
              const amountTWD = order.total_amount_twd !== undefined 
                ? order.total_amount_twd 
                : Math.round(order.total_amount * (order.exchange_rate || 1));
              const dateStr = order.created_at ? order.created_at.slice(5, 10).replace('-', '/') : '';
              
              return (
                <div
                  key={order.id}
                  onClick={() => onOrderClick && onOrderClick(order.id)}
                  className="bg-white dark:bg-gray-800 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer w-full"
                >
                  <div className="min-w-0 pr-4 flex items-center gap-3">
                    <span className="w-10 h-10 border-2 border-black flex items-center justify-center text-sm shrink-0 font-black bg-[#4ECDC4] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Package size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-black dark:text-white text-base truncate uppercase">
                        {displayTitle}
                      </h3>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 font-mono font-bold truncate">
                        來源：{order.source} {order.tags && order.tags.length > 0 && `| 標籤: ${order.tags.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span className="text-base font-black text-black dark:text-white font-mono">
                      NT$ {amountTWD.toLocaleString()}
                    </span>
                    <span className="text-xs text-black dark:text-gray-300 font-mono font-bold">
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
  );
}


