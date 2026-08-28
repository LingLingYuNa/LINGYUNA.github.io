import React, { useState, useEffect, useRef } from 'react';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import SplitOrder from './components/SplitOrder';
import Tools from './components/Tools';
import AddOrder from './components/AddOrder';
import OrderDetail from './components/OrderDetail';
import QuickAddModal from './components/QuickAddModal';
import AddChoiceModal from './components/AddChoiceModal';
import AddItem from './components/AddItem';
import { Plus } from 'lucide-react';
import { db } from './db';
import { useHardwareBack } from './hooks/useHardwareBack';
import { useLiveQuery } from 'dexie-react-hooks';
import { uploadBackup, downloadBackup, requestAuth } from './utils/googleDriveSync';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-3xl border border-red-200 dark:border-red-900 text-center my-8 max-w-lg mx-auto shadow-lg space-y-3">
          <h3 className="font-bold text-lg">⚠️ 畫面繪製時發生異常</h3>
          <p className="text-xs opacity-80 break-all font-mono">{this.state.error?.toString()}</p>
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }} 
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            重新載入應用程式
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAddChoiceOpen, setIsAddChoiceOpen] = useState(false);
  const [isAddStandaloneItemOpen, setIsAddStandaloneItemOpen] = useState(false);
  const [quickAddOrderId, setQuickAddOrderId] = useState(null);
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollTop = useRef(0);

  // 讀取資料表資料以監聽變更
  const orders = useLiveQuery(() => db.orders.toArray());
  const items = useLiveQuery(() => db.items.toArray());
  const sales = useLiveQuery(() => db.sales.toArray());
  const customTags = useLiveQuery(() => db.custom_tags ? db.custom_tags.toArray() : Promise.resolve([]));
  const boxSplits = useLiveQuery(() => db.box_splits ? db.box_splits.toArray() : Promise.resolve([]));
  const boxSplitItems = useLiveQuery(() => db.box_split_items ? db.box_split_items.toArray() : Promise.resolve([]));
  const boxSplitParticipants = useLiveQuery(() => db.box_split_participants ? db.box_split_participants.toArray() : Promise.resolve([]));
  const characterSortOrders = useLiveQuery(() => db.character_sort_orders ? db.character_sort_orders.toArray() : Promise.resolve([]));

  const [isRestoreChecked, setIsRestoreChecked] = useState(false);
  const isFirstDataChange = useRef(true);

  // 1. 啟動時自動還原或版本衝突偵測
  useEffect(() => {
    const checkAndRestore = async () => {
      const isLinked = localStorage.getItem('google_drive_linked') === 'true';
      const isAutoSync = localStorage.getItem('google_drive_auto_sync') === 'true';
      let accessToken = localStorage.getItem('google_drive_access_token');
      const expiresAt = Number(localStorage.getItem('google_drive_token_expires_at')) || 0;

      if (!isLinked || !isAutoSync) {
        setIsRestoreChecked(true);
        return;
      }

      // 如果 Token 已過期但先前有連結帳號，優先嘗試自動靜默刷新授權
      if (!accessToken || Date.now() > expiresAt) {
        try {
          console.log('🔄 啟動檢測：Token 已過期，嘗試自動靜默刷新 Google 授權...');
          accessToken = await requestAuth(false);
        } catch (err) {
          console.warn('⚠️ 啟動檢測：自動靜默刷新授權失敗，本機本次將不進行同步還原:', err);
          setIsRestoreChecked(true);
          return;
        }
      }

      try {
        console.log('🔄 啟動檢測：正在從 Google Drive 讀取雲端備份...');
        const backupData = await downloadBackup();
        
        if (!backupData) {
          console.log('🔄 啟動檢測：雲端尚無備份檔案。');
          setIsRestoreChecked(true);
          return;
        }

        const { data, export_date } = backupData;
        if (!data || !data.orders || !data.items) {
          console.warn('🔄 啟動檢測：雲端備份格式不符，跳過自動還原。');
          setIsRestoreChecked(true);
          return;
        }

        const localOrdersCount = await db.orders.count();
        const localItemsCount = await db.items.count();
        const salesData = data.sales || [];
        const customTagsData = data.custom_tags || [];

        // 本機為空 -> 直接靜默還原
        if (localOrdersCount === 0 && localItemsCount === 0) {
          console.log('🔄 啟動檢測：本機無資料，自動還原雲端備份中...');
          await db.transaction('rw', db.orders, db.items, db.sales, db.custom_tags, async () => {
            if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
            if (data.items.length > 0) await db.items.bulkPut(data.items);
            if (salesData.length > 0) await db.sales.bulkPut(salesData);
            if (customTagsData.length > 0) await db.custom_tags.bulkPut(customTagsData);
          });
          localStorage.setItem('last_local_update', export_date || new Date().toISOString());
          alert('🔄 已自動從 Google Drive 同步並載入您的資產與標籤資料！');
          window.location.reload();
          return;
        }

        // 本機有資料 -> 衝突提示
        const lastLocalUpdate = localStorage.getItem('last_local_update');
        if (export_date && (!lastLocalUpdate || new Date(export_date) > new Date(lastLocalUpdate))) {
          const cloudTimeStr = new Date(export_date).toLocaleString('zh-TW', { hour12: false });
          const confirmRestore = window.confirm(
            `🔄 雲端同步提示\n\n偵測到您在 Google 雲端硬碟有更近期的備份資料（更新時間：${cloudTimeStr}）。\n\n是否要立即載入並覆蓋此裝置的舊資料？`
          );

          if (confirmRestore) {
            console.log('🔄 啟動檢測：使用者確認還原較新的雲端資料...');
            await db.transaction('rw', db.orders, db.items, db.sales, db.custom_tags, async () => {
              await db.orders.clear();
              await db.items.clear();
              await db.sales.clear();
              await db.custom_tags.clear();
              if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
              if (data.items.length > 0) await db.items.bulkPut(data.items);
              if (salesData.length > 0) await db.sales.bulkPut(salesData);
              if (customTagsData.length > 0) await db.custom_tags.bulkPut(customTagsData);
            });
            localStorage.setItem('last_local_update', export_date);
            alert('✅ 雲端資料與標籤同步還原成功！');
            window.location.reload();
            return;
          } else {
            localStorage.setItem('last_local_update', export_date);
          }
        }
      } catch (error) {
        console.error('🔄 啟動自動同步檢測失敗:', error);
      } finally {
        setIsRestoreChecked(true);
      }
    };

    checkAndRestore();
  }, []);

  // 2. 資料與標籤變更，背景 5 秒防抖自動備份
  useEffect(() => {
    if (!isRestoreChecked) return;
    if (!orders || !items || !sales || !customTags) return;

    if (isFirstDataChange.current) {
      isFirstDataChange.current = false;
      return;
    }

    const isLinked = localStorage.getItem('google_drive_linked') === 'true';
    const isAutoSync = localStorage.getItem('google_drive_auto_sync') === 'true';

    if (!isLinked || !isAutoSync) {
      return;
    }

    const nowStr = new Date().toISOString();
    localStorage.setItem('last_local_update', nowStr);
    console.log('🔄 偵測到本機資料或標籤異動，已規劃在 5 秒後進行背景備份...');

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('google_drive_access_token');
        const expires = Number(localStorage.getItem('google_drive_token_expires_at')) || 0;

        // 如果 Token 已過期但仍為連結狀態，在此處進行靜默授權刷新
        if (!token || Date.now() > expires) {
          console.log('🔄 背景同步：檢測到授權 Token 已過期，正在嘗試自動靜默刷新 Google 授權...');
          await requestAuth(false);
        }

        console.log('🔄 背景同步：開始自動上傳最新資料與標籤至雲端...');
        const backupData = {
          version: 4,
          export_date: nowStr,
          data: { 
            orders, items, sales, custom_tags: customTags,
            box_splits: boxSplits, box_split_items: boxSplitItems,
            box_split_participants: boxSplitParticipants, character_sort_orders: characterSortOrders
          }
        };
        await uploadBackup(backupData);
        console.log('✅ 背景同步：已成功自動備份至 Google Drive！');
      } catch (err) {
        console.error('❌ 背景同步自動上傳失敗 (可能未登入或 Session 已失效):', err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [orders, items, sales, customTags, boxSplits, boxSplitItems, boxSplitParticipants, characterSortOrders, isRestoreChecked]);

  // 綁定硬體返回鍵
  const handleCloseAddOrder = useHardwareBack(isAddOrderOpen, () => setIsAddOrderOpen(false), 'add-order');
  const handleCloseQuickAdd = useHardwareBack(isQuickAddOpen, () => { setIsQuickAddOpen(false); setQuickAddOrderId(null); }, 'quick-add');
  const handleBackOrderDetail = useHardwareBack(!!selectedOrderId, () => setSelectedOrderId(null), 'order-detail');

  // 統一處理分頁切換並清除所有彈窗與詳情狀態
  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setSelectedOrderId(null);
    setIsAddOrderOpen(false);
    setIsQuickAddOpen(false);
    setQuickAddOrderId(null);
  };

  // 當切換分頁或進入/離開訂單詳情時，重置加號球為顯示狀態
  useEffect(() => {
    setIsFabVisible(true);
  }, [currentTab, selectedOrderId]);

  // 防呆機制：當分頁切換時，自動關閉所有全域彈窗與詳情小票
  useEffect(() => {
    setSelectedOrderId(null);
    setIsAddOrderOpen(false);
    setIsQuickAddOpen(false);
    setQuickAddOrderId(null);
  }, [currentTab]);

  const handleScroll = (e) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // 如果接近底部（剩餘可滾動距離小於 20px），強制顯示加號球，方便點擊
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    if (isAtBottom) {
      setIsFabVisible(true);
      lastScrollTop.current = scrollTop;
      return;
    }
    
    // 滑動距離小於 10px 時忽略，避免微小抖動頻繁觸發 re-render
    if (Math.abs(scrollTop - lastScrollTop.current) < 10) {
      return;
    }
    
    if (scrollTop > lastScrollTop.current && scrollTop > 50) {
      setIsFabVisible(false); // 向下滑動隱藏
    } else {
      setIsFabVisible(true);  // 向上滑動顯示
    }
    
    lastScrollTop.current = scrollTop;
  };

  // 攔截訂單點擊：如果是日常記帳 (daily)，則開啟 QuickAddModal 編輯；若是週邊訂單則進入明細小票頁
  const handleOrderClick = async (orderId) => {
    try {
      const order = await db.orders.get(orderId);
      if (order && order.order_type === 'daily') {
        setQuickAddOrderId(orderId);
        setIsQuickAddOpen(true);
      } else {
        setSelectedOrderId(orderId);
      }
    } catch (err) {
      console.error('讀取訂單失敗，採用預設詳情頁:', err);
      setSelectedOrderId(orderId);
    }
  };

  return (
    // 最外層容器：手機版 max-w-md 置中，電腦版滿版 flex
    <div className="min-h-screen bg-primary-light/20 dark:bg-gray-950 max-w-md mx-auto md:max-w-none md:mx-0 relative pb-20 md:pb-0 shadow-2xl md:shadow-none overflow-hidden md:overflow-visible font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200 md:flex">
      
      {/* 電腦版左側邊欄 */}
      <Sidebar 
        currentTab={currentTab} 
        onTabChange={handleTabChange} 
      />
      
      {/* 主要內容區 */}
      <main 
        onScroll={handleScroll}
        className="flex-1 h-full overflow-y-auto md:ml-64 md:p-8 md:min-h-screen md:bg-gray-50 md:dark:bg-gray-950"
      >
        {selectedOrderId ? (
          <OrderDetail 
            orderId={selectedOrderId} 
            onBack={handleBackOrderDetail} 
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <Dashboard 
                onQuickAdd={() => {
                  setQuickAddOrderId(null);
                  setIsQuickAddOpen(true);
                }} 
                onOrderClick={handleOrderClick}
              />
            )}
            {currentTab === 'list' && (
              <ErrorBoundary>
                <OrderList 
                  currentTab={currentTab}
                  onOrderClick={handleOrderClick} 
                />
              </ErrorBoundary>
            )}
            {currentTab === 'scissors' && <SplitOrder />}
            {currentTab === 'wrench' && <Tools />}
          </>
        )}
      </main>

      {/* 電腦版懸浮新增按鈕 (FAB) - 在手機版隱藏，在電腦版固定右下角 */}
      <button 
        onClick={() => setIsAddChoiceOpen(true)}
        className="hidden md:flex md:fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 hover:-translate-y-1 transition-all duration-300 transform z-40"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* 底部導覽列 */}
      <BottomNav currentTab={currentTab} onTabChange={handleTabChange} onAddClick={() => setIsAddChoiceOpen(true)} />

      {/* 新增類型選擇彈窗 */}
      {isAddChoiceOpen && (
        <AddChoiceModal 
          onClose={() => setIsAddChoiceOpen(false)}
          onSelectChoice={(type) => {
            setIsAddChoiceOpen(false);
            if (type === 'order') {
              setIsAddOrderOpen(true);
            } else if (type === 'item') {
              setIsAddStandaloneItemOpen(true);
            } else if (type === 'quick') {
              setQuickAddOrderId(null);
              setIsQuickAddOpen(true);
            }
          }}
        />
      )}

      {/* 新增訂單彈窗 */}
      {isAddOrderOpen && (
        <AddOrder onClose={handleCloseAddOrder} />
      )}

      {/* 單獨新增物品彈窗 */}
      {isAddStandaloneItemOpen && (
        <AddItem onClose={() => setIsAddStandaloneItemOpen(false)} />
      )}

      {/* 快速記帳彈窗 */}
      {isQuickAddOpen && (
        <QuickAddModal 
          orderId={quickAddOrderId} 
          onClose={handleCloseQuickAdd} 
        />
      )}
    </div>
  );
}

export default App;
