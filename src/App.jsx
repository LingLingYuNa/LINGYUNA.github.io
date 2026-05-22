import React, { useState } from 'react';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import SplitOrder from './components/SplitOrder';
import Tools from './components/Tools';
import AddOrder from './components/AddOrder';
import OrderDetail from './components/OrderDetail';
import QuickAddModal from './components/QuickAddModal';
import { Plus } from 'lucide-react';
import { db } from './db';

function App() {
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddOrderId, setQuickAddOrderId] = useState(null);
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

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
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSelectedOrderId(null); // 切換分頁時自動返回列表，避免卡在詳情頁
        }} 
      />
      
      {/* 主要內容區 */}
      <main className="flex-1 h-full overflow-y-auto md:ml-64 md:p-8 md:min-h-screen md:bg-gray-50 md:dark:bg-gray-950">
        {selectedOrderId ? (
          <OrderDetail 
            orderId={selectedOrderId} 
            onBack={() => setSelectedOrderId(null)} 
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
              <OrderList 
                onOrderClick={handleOrderClick} 
              />
            )}
            {currentTab === 'scissors' && <SplitOrder />}
            {currentTab === 'wrench' && <Tools />}
          </>
        )}
      </main>

      {/* 懸浮新增按鈕 (FAB) - 在手機版 relative/absolute bottom-24，在電腦版 fixed bottom-8 */}
      <button 
        onClick={() => setIsAddOrderOpen(true)}
        className="absolute md:fixed bottom-24 md:bottom-8 right-5 md:right-8 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 hover:-translate-y-1 transition-all z-40"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* 底部導覽列 */}
      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* 新增訂單彈窗 */}
      {isAddOrderOpen && (
        <AddOrder onClose={() => setIsAddOrderOpen(false)} />
      )}

      {/* 快速記帳彈窗 */}
      {isQuickAddOpen && (
        <QuickAddModal 
          orderId={quickAddOrderId} 
          onClose={() => {
            setIsQuickAddOpen(false);
            setQuickAddOrderId(null);
          }} 
        />
      )}
    </div>
  );
}

export default App;
