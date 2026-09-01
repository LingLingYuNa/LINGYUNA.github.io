import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { STATUS_COLORS, CURRENCIES, DEFAULT_TAGS, getStatusStyle, PAYMENT_METHOD_ICONS } from '../constants';
import { getItemIps, getDeadlineInfo, calculateOrderTotalTWD, compressImage } from '../utils';
import { PackageOpen, LayoutGrid, List, X, Image as ImageIcon, Pencil, Trash2, DollarSign, Search, CheckSquare, Square, Boxes, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import AddOrder from './AddOrder';
import SellItem from './SellItem';
import ReconciliationModal from './ReconciliationModal';
import AddItem from './AddItem';
import AssignOrderModal from './AssignOrderModal';

// 輔助函數：解析角色陣列，相容舊字串格式
const getItemRoles = (item) => {
  if (!item) return [];
  if (item.roles && Array.isArray(item.roles)) {
    return item.roles;
  }
  const charStr = item.character || item.role || '';
  return charStr ? charStr.split(',').map(s => s.trim()).filter(Boolean) : [];
};

// 輔助函數：格式化日期為 YYYY/MM/DD 短格式
const formatOrderDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split('T')[0] || '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${r}`;
  } catch (e) {
    return dateStr.split('T')[0] || '';
  }
};

export default function OrderList({ onOrderClick, currentTab }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'gallery'
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null);
  const [listType, setListType] = useState('expenses'); // 'expenses' | 'incomes'
  const [selectedSaleToEdit, setSelectedSaleToEdit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [isReconOpen, setIsReconOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [zoomImage, setZoomImage] = useState(null);
  const [dateSort, setDateSort] = useState('desc'); // 'desc' | 'asc'
  const [mainTab, setMainTab] = useState('orders'); // 'orders' | 'unassigned'
  const [assigningItem, setAssigningItem] = useState(null);
  const [assigningItems, setAssigningItems] = useState([]);
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState([]);
  const [isAddStandaloneOpen, setIsAddStandaloneOpen] = useState(false);
  const [editingStandaloneItem, setEditingStandaloneItem] = useState(null);

  // 手機觸控滑動位置紀錄
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const isUrl = (str) => typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));

  // 當選擇的物品改變時，重設圖片輪播的 active 索引
  useEffect(() => {
    setActiveImgIndex(0);
  }, [selectedItem]);

  // 批次選取狀態
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // 智慧清理：當切換分頁離開「清單」時，強制清理所有彈窗狀態以防殘留
  useEffect(() => {
    if (currentTab && currentTab !== 'list') {
      setSelectedItem(null);
      setEditingOrder(null);
      setSelectedSaleToEdit(null);
      setIsReconOpen(false);
      setZoomImage(null);
    }
  }, [currentTab]);

  // 防呆機制：當此元件被卸載 (Unmount) 時，也一併執行狀態清理
  useEffect(() => {
    return () => {
      setSelectedItem(null);
      setEditingOrder(null);
      setSelectedSaleToEdit(null);
      setIsReconOpen(false);
      setZoomImage(null);
    };
  }, []);

  // 安全防護：當過濾條件、分頁 Tab 或檢視模式改變時，自動清空選取狀態
  useEffect(() => {
    setSelectedIds([]);
    setIsSelectMode(false);
  }, [searchQuery, activeTag, selectedBuyer, listType, viewMode]);

  // 監聽鍵盤 ESC 鍵以關閉圖片放大 Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setZoomImage(null);
      }
    };
    if (zoomImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomImage]);

  // 刪除整筆訂單與級聯刪除邏輯
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('確定要刪除這筆訂單嗎？此操作將會一併刪除底下的所有物品與售出紀錄，且無法復原！')) return;
    
    try {
      await db.transaction('rw', db.orders, db.items, db.sales, async () => {
        // 1. 撈出這筆訂單底下的所有物品 ID
        const currentItems = await db.items.where({ order_id: orderId }).toArray();
        const itemIds = currentItems.map(item => item.id);
        
        // 2. 刪除這些物品對應的售出紀錄 (sales)
        if (itemIds.length > 0) {
          await db.sales.where('item_id').anyOf(itemIds).delete();
        }
        
        // 3. 刪除這些物品 (items)
        await db.items.where({ order_id: orderId }).delete();
        
        // 4. 刪除父訂單本身 (orders)
        await db.orders.delete(orderId);
      });
    } catch (error) {
      console.error('刪除訂單失敗:', error);
      alert('刪除失敗，請重試');
    }
  };

  // 即時監聽 IndexedDB (一律加上 || [] 防呆空值)
  const orders = useLiveQuery(() => {
    let q = db.orders.orderBy('created_at');
    if (dateSort === 'desc') {
      q = q.reverse();
    }
    return q.toArray();
  }, [dateSort]) || [];
  const items = useLiveQuery(() => db.items.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const customTags = useLiveQuery(() => db.custom_tags.orderBy('sort_order').toArray()) || [];

  const tagsToRender = customTags.length > 0 ? Array.from(new Set(customTags.map(t => t.name))) : DEFAULT_TAGS;
 
  // 整理 Gallery / Items 需要的項目，並進行標籤與搜尋關鍵字篩選
  const filteredItems = useMemo(() => {
    if (!items) return [];

    // 依據 dateSort 進行排序
    const sortedItems = [...items].sort((a, b) => {
      const timeA = new Date(a.created_at || a.id || 0).getTime();
      const timeB = new Date(b.created_at || b.id || 0).getTime();
      return dateSort === 'desc' ? timeB - timeA : timeA - timeB;
    });

    let result = sortedItems;
    const query = searchQuery.trim().toLowerCase();

    // 1. 標籤篩選
    if (activeTag) {
      result = result.filter(item => {
        const itemTags = item.tags && Array.isArray(item.tags)
          ? item.tags
          : (item.tag ? [item.tag] : []);
        const hasTagInItem = itemTags.includes(activeTag);

        const associatedOrder = orders?.find(o => o.id === item.order_id);
        const orderTags = associatedOrder && Array.isArray(associatedOrder.tags) ? associatedOrder.tags : [];
        const hasTagInOrder = orderTags.includes(activeTag);

        return hasTagInItem || hasTagInOrder;
      });
    }

    // 2. 關鍵字搜尋
    if (query) {
      result = result.filter(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(query);
        
        const itemRoles = getItemRoles(item);
        const rolesMatch = itemRoles.some(r => r.toLowerCase().includes(query));

        const associatedOrder = orders?.find(o => o.id === item.order_id);
        const orderTitleMatch = associatedOrder && associatedOrder.title && associatedOrder.title.toLowerCase().includes(query);
        const orderSourceMatch = associatedOrder && associatedOrder.source && associatedOrder.source.toLowerCase().includes(query);

        const sourceTypeMatch = item.source_type && (
          (item.source_type === 'official' && '官方'.includes(query)) ||
          (item.source_type === 'fan' && '同人'.includes(query))
        );
        const fanSourceMatch = item.fan_source && item.fan_source.toLowerCase().includes(query);

        return nameMatch || rolesMatch || orderTitleMatch || orderSourceMatch || sourceTypeMatch || fanSourceMatch;
      });
    }

    return result;
  }, [items, orders, activeTag, searchQuery, dateSort]);

  // --- 圖牆 / 圖片預覽：切換至下一組/張圖片或物品 ---
  const handleNextImageOrItem = () => {
    if (!selectedItem) return;
    const currentList = filteredItems && filteredItems.length > 0 ? filteredItems : items;
    if (!currentList || currentList.length === 0) return;

    const currentItemIdx = currentList.findIndex(i => i.id === selectedItem.id);
    const itemImages = selectedItem.images && Array.isArray(selectedItem.images) && selectedItem.images.length > 0
      ? selectedItem.images
      : (selectedItem.image ? [selectedItem.image] : []);

    // 1. 若當前物品多圖且非最後一張，先切換圖片
    if (activeImgIndex < itemImages.length - 1) {
      const nextImgIdx = activeImgIndex + 1;
      setActiveImgIndex(nextImgIdx);
      if (zoomImage) {
        setZoomImage(itemImages[nextImgIdx]);
      }
    } else {
      // 2. 切換至下一個物品 (組)
      const nextItemIdx = currentItemIdx === -1 ? 0 : (currentItemIdx + 1) % currentList.length;
      const nextItem = currentList[nextItemIdx];
      const nextItemImages = nextItem.images && Array.isArray(nextItem.images) && nextItem.images.length > 0
        ? nextItem.images
        : (nextItem.image ? [nextItem.image] : []);
      
      setSelectedItem(nextItem);
      setActiveImgIndex(0);
      if (zoomImage) {
        setZoomImage(nextItemImages[0] || null);
      }
    }
  };

  // --- 圖牆 / 圖片預覽：切換至上一組/張圖片或物品 ---
  const handlePrevImageOrItem = () => {
    if (!selectedItem) return;
    const currentList = filteredItems && filteredItems.length > 0 ? filteredItems : items;
    if (!currentList || currentList.length === 0) return;

    const currentItemIdx = currentList.findIndex(i => i.id === selectedItem.id);
    const itemImages = selectedItem.images && Array.isArray(selectedItem.images) && selectedItem.images.length > 0
      ? selectedItem.images
      : (selectedItem.image ? [selectedItem.image] : []);

    // 1. 若當前物品多圖且非第一張，先切換圖片
    if (activeImgIndex > 0) {
      const prevImgIdx = activeImgIndex - 1;
      setActiveImgIndex(prevImgIdx);
      if (zoomImage) {
        setZoomImage(itemImages[prevImgIdx]);
      }
    } else {
      // 2. 切換至上一個物品 (組)
      const prevItemIdx = currentItemIdx <= 0 ? currentList.length - 1 : currentItemIdx - 1;
      const prevItem = currentList[prevItemIdx];
      const prevItemImages = prevItem.images && Array.isArray(prevItem.images) && prevItem.images.length > 0
        ? prevItem.images
        : (prevItem.image ? [prevItem.image] : []);
      
      const lastImgIdx = Math.max(0, prevItemImages.length - 1);
      setSelectedItem(prevItem);
      setActiveImgIndex(lastImgIdx);
      if (zoomImage) {
        setZoomImage(prevItemImages[lastImgIdx] || null);
      }
    }
  };

  // 手機 Touch 觸控滑動處理 (Swipe Left -> Next, Swipe Right -> Prev)
  const handleTouchStart = (e) => {
    if (e.targetTouches && e.targetTouches[0]) {
      touchStartX.current = e.targetTouches[0].clientX;
    }
  };

  const handleTouchMove = (e) => {
    if (e.targetTouches && e.targetTouches[0]) {
      touchEndX.current = e.targetTouches[0].clientX;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 40; // 40px 滑動閥值

    if (distance > minSwipeDistance) {
      // 向左滑動 -> 下一組/張
      handleNextImageOrItem();
    } else if (distance < -minSwipeDistance) {
      // 向右滑動 -> 上一組/張
      handlePrevImageOrItem();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // 全局鍵盤左右方向鍵導覽
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedItem && !zoomImage) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextImageOrItem();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevImageOrItem();
      } else if (e.key === 'Escape') {
        setSelectedItem(null);
        setZoomImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItem, activeImgIndex, filteredItems, items, zoomImage]);

  // 載入中狀態
  if (orders === undefined || items === undefined || sales === undefined) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <span className="text-gray-400 font-medium">載入中...</span>
      </div>
    );
  }

  const uniqueBuyers = Array.from(
    new Set(
      sales
        ? sales.map(sale => sale.buyer_id).filter(id => id && id.trim() !== '')
        : []
    )
  );

  // 1. 處理搜尋與標籤過濾邏輯
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredOrders = orders.filter((order) => {
    // 取得該訂單下的所有物品
    const orderItems = items.filter(item => item.order_id === order.id);

    // 標籤過濾
    if (activeTag) {
      const orderTags = order.tags || [];
      const hasTagInOrder = orderTags.includes(activeTag);
      const hasTagInItems = orderItems.some(item => {
        const itemTags = item.tags && Array.isArray(item.tags)
          ? item.tags
          : (item.tag ? [item.tag] : []);
        return itemTags.includes(activeTag);
      });
      if (!hasTagInOrder && !hasTagInItems) {
        return false;
      }
    }

    // 關鍵字搜尋
    if (normalizedQuery) {
      const titleMatch = order.title && order.title.toLowerCase().includes(normalizedQuery);
      const sourceMatch = order.source && order.source.toLowerCase().includes(normalizedQuery);
      const itemsMatch = orderItems.some(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(normalizedQuery);
        const itemRoles = getItemRoles(item);
        const rolesMatch = itemRoles.some(r => r.toLowerCase().includes(normalizedQuery));
        return nameMatch || rolesMatch;
      });
      return titleMatch || sourceMatch || itemsMatch;
    }

    return true;
  });

  const filteredSales = sales.filter((sale) => {
    const item = items.find(i => i.id === sale.item_id);
    const order = item ? orders.find(o => o.id === item.order_id) : null;

    // 標籤過濾
    if (activeTag) {
      const itemTags = item && item.tags && Array.isArray(item.tags)
        ? item.tags
        : (item && item.tag ? [item.tag] : []);
      const hasTagInItem = itemTags.includes(activeTag);
      const hasTagInOrder = order && order.tags && order.tags.includes(activeTag);
      if (!hasTagInItem && !hasTagInOrder) {
        return false;
      }
    }

    // 買家篩選
    if (selectedBuyer) {
      if (sale.buyer_id !== selectedBuyer) {
        return false;
      }
    }

    // 關鍵字搜尋
    if (normalizedQuery) {
      const buyerMatch = sale.buyer_id && sale.buyer_id.toLowerCase().includes(normalizedQuery);
      const itemNameMatch = item && item.name && item.name.toLowerCase().includes(normalizedQuery);
      const itemCharMatch = item && getItemRoles(item).some(r => r.toLowerCase().includes(normalizedQuery));
      return buyerMatch || itemNameMatch || itemCharMatch;
    }

    return true;
  });

  // (已將此 useMemo 移動至早期 Return 之前，以遵循 React Hooks 規則)

  // 切換選取項目
  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  // 全選當前過濾後的清單
  const handleSelectAll = () => {
    if (listType === 'expenses') {
      const allIds = filteredOrders.map(o => o.id);
      setSelectedIds(allIds);
    } else {
      const allIds = filteredSales.map(s => s.id);
      setSelectedIds(allIds);
    }
  };

  // 動態加總金額
  const totalSelectedAmount = selectedIds.reduce((sum, id) => {
    if (viewMode === 'items') {
      const item = items.find(x => x.id === id);
      if (!item) return sum;
      const associatedOrder = orders?.find(o => o.id === item.order_id);
      const exchangeRate = associatedOrder ? Number(associatedOrder.exchange_rate) : 1;
      const costTWD = item.twd_net_cost !== undefined 
        ? item.twd_net_cost 
        : Math.round(Number(item.price || 0) * exchangeRate);
      return sum + costTWD;
    } else if (listType === 'expenses') {
      const o = orders.find(x => x.id === id);
      if (!o) return sum;
      // 優先使用 total_amount_twd，相容舊資料
      return sum + (o.total_amount_twd !== undefined 
        ? o.total_amount_twd 
        : Math.round(o.total_amount * (o.exchange_rate || 1)));
    } else {
      const s = sales.find(x => x.id === id);
      if (!s) return sum;
      return sum + s.price;
    }
  }, 0);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* 標題與 Toggle 區 */}
      <header className="flex justify-between items-end mt-2 px-1 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {viewMode === 'list' ? '訂單清單' : viewMode === 'items' ? '物品清單' : viewMode === 'gallery' ? '收藏圖牆' : '收支日曆'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {viewMode === 'items' ? '所有週邊的單品明細' : '所有的週邊敗家紀錄'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-gray-800 p-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 font-black transition-all border-2 ${
                viewMode === 'list' 
                  ? 'bg-[#FFE66D] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
              }`}
              title="訂單清單"
            >
              <List size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setViewMode('items')}
              className={`p-2 font-black transition-all border-2 ${
                viewMode === 'items' 
                  ? 'bg-[#FFE66D] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
              }`}
              title="物品清單"
            >
              <Boxes size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-2 font-black transition-all border-2 ${
                viewMode === 'gallery' 
                  ? 'bg-[#FFE66D] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
              }`}
              title="圖牆模式"
            >
              <LayoutGrid size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* 內容區 */}
      {viewMode === 'list' ? (
        // --- 列表模式 ---
        <div className="space-y-4">
          {/* 支出 / 收入 / 待歸屬 三分頁 Tab */}
          <div className="flex bg-white dark:bg-gray-800 p-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none gap-1">
            <button
              onClick={() => setListType('expenses')}
              className={`flex-1 py-2 text-center text-xs font-black rounded-none transition-all uppercase border-2 ${
                listType === 'expenses' 
                  ? 'bg-[#FF6B6B] text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              支出 (Expenses)
            </button>
            <button
              onClick={() => setListType('incomes')}
              className={`flex-1 py-2 text-center text-xs font-black rounded-none transition-all uppercase border-2 ${
                listType === 'incomes' 
                  ? 'bg-[#4ECDC4] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              收入 (Incomes)
            </button>
            <button
              onClick={() => setListType('unassigned')}
              className={`flex-1 py-2 text-center text-xs font-black rounded-none transition-all flex items-center justify-center gap-1 uppercase border-2 ${
                listType === 'unassigned' 
                  ? 'bg-[#FFE66D] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                  : 'border-transparent text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>待歸屬</span>
              {items && items.filter(i => !i.order_id).length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 border border-black bg-black text-white font-black">
                  {items.filter(i => !i.order_id).length}
                </span>
              )}
            </button>
          </div>

          {/* 搜尋與標籤過濾 */}
          <div className="space-y-2">
            {/* 搜尋與按鈕組合 */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black dark:text-gray-400">
                  <Search size={18} strokeWidth={2.5} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={listType === 'expenses' ? "搜尋訂單名稱、來源、商品、角色..." : "搜尋買家暱稱、商品名稱..."}
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-sm font-bold focus:outline-none placeholder:text-gray-500 text-black dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-black dark:hover:text-white"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {listType === 'incomes' && !isSelectMode && (
                <button
                  type="button"
                  onClick={() => setIsReconOpen(true)}
                  className="px-3.5 py-2.5 bg-[#4ECDC4] text-black font-black text-xs border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer uppercase"
                  title="生成買家對帳單"
                >
                  <span>對帳單</span>
                </button>
              )}

              {/* 排序按鈕 */}
              <button
                type="button"
                onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
                className="px-3.5 py-2.5 bg-[#FFE66D] text-black font-black text-xs border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1 shrink-0 select-none cursor-pointer uppercase"
                title={dateSort === 'desc' ? '由新到舊排序' : '由舊到新排序'}
              >
                <span>{dateSort === 'desc' ? '新➔舊' : '舊➔新'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-2.5 font-black text-xs border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer uppercase ${
                  isSelectMode
                    ? 'bg-black text-white'
                    : 'bg-[#FF6B6B] text-white'
                }`}
              >
                <span>{isSelectMode ? '取消' : '選取'}</span>
              </button>
            </div>

            {listType === 'incomes' && uniqueBuyers.length > 0 && (
              <div className="flex items-center gap-2 mt-2 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0">買家篩選：</span>
                <div className="relative flex-1">
                  <select
                    value={selectedBuyer}
                    onChange={(e) => setSelectedBuyer(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-gray-800 dark:text-gray-100"
                  >
                    <option value="">全部買家</option>
                    {uniqueBuyers.map(buyer => (
                      <option key={buyer} value={buyer}>{buyer}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 dark:text-gray-500">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

          </div>

          {listType === 'expenses' ? (
            // 支出分頁 (Orders)
            orders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-6 transition-colors">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-300 dark:text-blue-500 rounded-none flex items-center justify-center mb-4">
                  <PackageOpen size={32} />
                </div>
                <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">目前尚無訂單</h3>
                <p className="text-sm text-gray-400 dark:text-gray-400">點擊右下角的 + 號<br/>開始記錄你的第一筆週邊吧！</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-6 transition-colors">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-500 rounded-none flex items-center justify-center mb-4">
                  <Search size={32} />
                </div>
                <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">找不到符合的紀錄</h3>
                <p className="text-sm text-gray-400 dark:text-gray-400">請嘗試不同的關鍵字或標籤篩選</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-32">
                {filteredOrders.map((order) => {
                  const orderItems = items.filter(item => item.order_id === order.id);
                  const isDaily = order.order_type === 'daily' || orderItems.length === 0;
                  const isSelected = selectedIds.includes(order.id);

                  if (isDaily) {
                    return (
                      <div 
                        key={order.id} 
                        onClick={() => {
                          if (isSelectMode) {
                            toggleSelection(order.id);
                          } else {
                            onOrderClick && onOrderClick(order.id);
                          }
                        }}
                        className={`px-4 py-3.5 rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center transition-all duration-200 cursor-pointer ${
                          isSelected 
                            ? 'bg-[#FFE66D] text-black' 
                            : 'bg-white dark:bg-gray-800 hover:translate-x-[2px] hover:translate-y-[2px]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* 圓圈 Checkbox */}
                          {isSelectMode && (
                            <div 
                              className="shrink-0 mr-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelection(order.id)}
                                className="w-4.5 h-4.5 rounded-none border-gray-300 dark:border-gray-600 text-primary focus:ring-primary accent-primary cursor-pointer"
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              {/* 左側標籤 */}
                              {order.tags && order.tags[0] ? (
                                <span className="text-[10px] bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-2 py-0.5 rounded-none font-bold shrink-0">
                                  {order.tags[0]}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 dark:bg-gray-750 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-none font-bold shrink-0">
                                  無標籤
                                </span>
                              )}
                              {/* 名稱 */}
                              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                                {order.title || order.source || '日常支出'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold flex items-center gap-1">
                              {formatOrderDate(order.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          {/* 支付方式 Icon */}
                          <span 
                            className="text-xs" 
                            title={`支付方式: ${order.payment_method || '現金'}`}
                          >
                            {order.payment_method || '現金'}
                          </span>
                          {/* 金額 */}
                          <span className="font-black text-gray-800 dark:text-gray-100 text-sm">
                            NT$ {Math.round(order.total_amount).toLocaleString()}
                          </span>
                          
                          {/* 操作按鈕 (編輯 & 刪除，選取模式下隱藏) */}
                          {!isSelectMode && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  onOrderClick && onOrderClick(order.id);
                                }}
                                className="text-gray-400 hover:text-primary-dark dark:hover:text-primary p-1.5 rounded-none transition-colors hover:bg-primary-light/30 dark:hover:bg-gray-700/50"
                                title="編輯記帳"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-none transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                                title="刪除記帳"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={order.id} 
                      onClick={() => {
                        if (isSelectMode) {
                          toggleSelection(order.id);
                        } else {
                          onOrderClick && onOrderClick(order.id);
                        }
                      }}
                      className={`p-4 rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? 'bg-[#FFE66D] text-black' 
                          : 'bg-white dark:bg-gray-800 hover:translate-x-[2px] hover:translate-y-[2px]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {/* 圓圈 Checkbox */}
                        {isSelectMode && (
                          <div 
                            className="shrink-0 mr-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(order.id)}
                              className="w-4.5 h-4.5 rounded-none border-gray-300 dark:border-gray-600 text-primary focus:ring-primary accent-primary cursor-pointer"
                            />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base truncate">
                            {order.title || order.source}
                          </h3>
                          <div className="flex items-center gap-2.5 flex-wrap mt-0.5 text-xs text-gray-400 dark:text-gray-500 font-semibold">
                            {order.title && order.source && (
                              <span className="truncate">來源：{order.source}</span>
                            )}
                            <span className="flex items-center gap-1 shrink-0">
                              {formatOrderDate(order.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                              {(() => {
                                const curr = CURRENCIES.find(c => c.code === order.currency);
                                const symbol = curr ? curr.symbol : (order.exchange_rate === 5.5 || order.exchange_rate === 0.23 ? '¥' : '$');
                                return `${symbol}${order.total_amount}`;
                              })()}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(結匯匯率: {order.exchange_rate})</span>
                            <span 
                              className="text-[9px] font-bold text-gray-500 dark:text-gray-405 flex items-center gap-0.5 bg-gray-50 dark:bg-gray-750 px-1.5 py-0.5 rounded border border-gray-150/45 dark:border-gray-700/30 transition-colors"
                              title={`支付方式: ${order.payment_method || 'ATM/轉帳'}`}
                            >
                              <span>{order.payment_method || 'ATM/轉帳'}</span>
                              <span className="scale-90 origin-left">{order.payment_method || 'ATM/轉帳'}</span>
                            </span>
                          </div>
                          {/* 訂單分類標籤 */}
                          {order.tags && order.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {order.tags.map(t => (
                                <span 
                                  key={t} 
                                  className="text-[9px] bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-2 py-0.5 rounded font-bold shrink-0"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {(() => {
                          const statusInfo = getStatusStyle(order.status);
                          return (
                            <span 
                              className={`text-xs px-2.5 py-1 rounded-none whitespace-nowrap inline-flex items-center gap-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${statusInfo.color}`}
                            >
                              <span>{statusInfo.dot}</span>
                              <span>{statusInfo.label}</span>
                            </span>
                          );
                        })()}
                        {order.status === '已喊單' && order.payment_deadline && (() => {
                          const deadlineInfo = getDeadlineInfo(order.payment_deadline);
                          if (!deadlineInfo) return null;
                          return (
                            <span className={`text-[10px] px-2 py-0.5 rounded-none font-bold transition-all border ${deadlineInfo.colorClass}`}>
                              {deadlineInfo.text}
                            </span>
                          );
                        })()}
                        {/* 操作按鈕 (編輯 & 刪除，選取模式下隱藏) */}
                        {!isSelectMode && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOrder(order);
                              }}
                              className="text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary p-1.5 rounded-none transition-colors hover:bg-primary-light/30 dark:hover:bg-gray-700/50"
                              title="編輯訂單"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                              className="text-gray-400 dark:text-gray-500 hover:text-red-500 p-1.5 rounded-none transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                              title="刪除訂單"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : listType === 'unassigned' ? (
            // 待歸屬物品分頁 (Unassigned Items)
            (() => {
              const safeItems = items || [];
              let unassignedList = safeItems.filter(i => i && !i.order_id);

              if (activeTag) {
                unassignedList = unassignedList.filter(item => {
                  const itemTags = item && item.tags && Array.isArray(item.tags) ? item.tags : (item && item.tag ? [item.tag] : []);
                  return itemTags.includes(activeTag);
                });
              }

              if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                unassignedList = unassignedList.filter(item => {
                  const nameMatch = item && item.name && item.name.toLowerCase().includes(q);
                  const ips = getItemIps(item);
                  const ipMatch = ips.some(ipName => ipName && ipName.toLowerCase().includes(q));
                  const roles = getItemRoles(item);
                  const roleMatch = roles.some(r => r && r.toLowerCase().includes(q));
                  return nameMatch || ipMatch || roleMatch;
                });
              }

              const safeSelectedIds = selectedUnassignedIds || [];
              const isAllSelected = unassignedList.length > 0 && safeSelectedIds.length === unassignedList.length;

              const toggleSelectAll = () => {
                if (isAllSelected) {
                  setSelectedUnassignedIds([]);
                } else {
                  setSelectedUnassignedIds(unassignedList.map(i => i && i.id).filter(Boolean));
                }
              };

              const toggleItemSelect = (id) => {
                if (!id) return;
                setSelectedUnassignedIds(prev => {
                  const safePrev = prev || [];
                  return safePrev.includes(id) ? safePrev.filter(x => x !== id) : [...safePrev, id];
                });
              };

              const selectedItemsList = unassignedList.filter(i => i && i.id && safeSelectedIds.includes(i.id));
              const selectedTotalSum = selectedItemsList.reduce((sum, i) => sum + (Number(i?.price || 0) * Number(i?.quantity || 1)), 0);

              return unassignedList.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-6 transition-colors">
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-none flex items-center justify-center mb-4">
                    <PackageOpen size={32} />
                  </div>
                  <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">目前尚無獨立待歸屬物品</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mb-4">先單獨登記的戰利品或週邊會顯示於此<br/>方便隨時一鍵併入指定訂單</p>
                  <button
                    onClick={() => setIsAddStandaloneOpen(true)}
                    className="px-4 py-2 bg-secondary-dark text-white text-xs font-bold rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-secondary-dark/90 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    <span>單獨新增第一筆物品</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pb-32 relative">
                  {/* 控制列 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-secondary-light/30 dark:bg-secondary-dark/10 border border-secondary-light dark:border-secondary-dark/30 rounded-none">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="px-2.5 py-1 bg-white dark:bg-gray-800 border-2 border-black hover:bg-gray-50 text-gray-700 dark:text-gray-200 rounded-none text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        {isAllSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-gray-400" />}
                        <span>全選 ({safeSelectedIds.length}/{unassignedList.length})</span>
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">
                        勾選下方物品可批次併入訂單
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddStandaloneOpen(true)}
                      className="px-3 py-1.5 bg-secondary-dark text-white rounded-none text-xs font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-secondary-dark/90 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                    >
                      <Plus size={14} />
                      <span>新增獨立物品</span>
                    </button>
                  </div>

                  {/* 待歸屬物品卡片牆 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unassignedList.map(item => {
                      if (!item) return null;
                      const isSelected = safeSelectedIds.includes(item.id);
                      const coverImg = (item.images && Array.isArray(item.images) && item.images[0]) || item.image;
                      const itemTotalPrice = Number(item.price || 0) * Number(item.quantity || 1);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => toggleItemSelect(item.id)}
                          className={`bg-white dark:bg-gray-800 rounded-none p-4 border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3 transition-all flex flex-col justify-between cursor-pointer select-none ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/20 bg-primary-light/10 dark:bg-primary-dark/10' 
                              : 'border-gray-150 dark:border-gray-750 hover:border-secondary/50'
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            {/* Checkbox Icon */}
                            <div className="pt-0.5 shrink-0 text-primary">
                              {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                            </div>

                            {coverImg ? (
                              <img 
                                src={coverImg} 
                                alt={item.name || '物品照片'}
                                className="w-16 h-16 object-cover rounded-none border-2 border-black shrink-0" 
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 shrink-0">
                                <PackageOpen size={24} />
                              </div>
                            )}

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                                  {item.name || '未命名物品'}
                                </h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-none font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/50 shrink-0">
                                  待歸屬
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                {getItemIps(item).map((ipName, idx) => (
                                  <span key={idx} className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                    {ipName}
                                  </span>
                                ))}
                                {getItemRoles(item).map(r => (
                                  <span key={r} className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                    {r}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1">
                                <span className="text-gray-400">數量: x{item.quantity || 1}</span>
                                <span className="font-bold text-primary-dark dark:text-primary text-sm">
                                  ${itemTotalPrice}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 動作按鈕 */}
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-750 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setAssigningItem(item);
                              }}
                              className="flex-1 py-2 px-3 bg-primary text-white rounded-none text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-primary-dark active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <PackageOpen size={14} />
                              <span>單獨歸屬</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => setEditingStandaloneItem(item)}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-none transition-colors"
                              title="編輯物品"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`確定要刪除「${item.name}」嗎？`)) {
                                  await db.items.delete(item.id);
                                  setSelectedUnassignedIds(prev => (prev || []).filter(id => id !== item.id));
                                }
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-none transition-colors"
                              title="刪除物品"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 多選勾選懸浮操作列 */}
                  {safeSelectedIds.length > 0 && (
                    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-gray-900/95 dark:bg-gray-800/95 text-white p-3.5 rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] backdrop-blur-md flex items-center justify-between gap-3 border border-gray-700/60 z-50 animate-in slide-in-from-bottom-5">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <CheckSquare size={16} className="text-primary" />
                          <span>已選擇 {safeSelectedIds.length} 筆物品</span>
                        </div>
                        <div className="text-xs text-gray-300 truncate">
                          合計：NT${selectedTotalSum}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningItem(null);
                            setAssigningItems(selectedItemsList);
                          }}
                          className="px-3.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-none text-xs font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <PackageOpen size={14} />
                          <span>歸屬至訂單</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`確定要刪除已選取的 ${safeSelectedIds.length} 筆物品嗎？`)) {
                              await db.items.where('id').anyOf(safeSelectedIds).delete();
                              setSelectedUnassignedIds([]);
                            }
                          }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-none transition-colors"
                          title="批量刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedUnassignedIds([])}
                          className="p-2 text-gray-400 hover:text-white rounded-none transition-colors text-xs font-bold"
                          title="取消選擇"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            // 收入分頁 (Sales)
            (() => {
              const sortedFilteredSales = [...filteredSales].sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return dateSort === 'desc' ? timeB - timeA : timeA - timeB;
              });
              return sales.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-6 transition-colors">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-300 dark:text-emerald-500 rounded-none flex items-center justify-center mb-4">
                    <DollarSign size={32} />
                  </div>
                  <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">目前尚無回血收入</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400">當你在訂單內將物品售出後<br/>回血紀錄就會顯示於此！</p>
                </div>
              ) : sortedFilteredSales.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-6 transition-colors">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-500 rounded-none flex items-center justify-center mb-4">
                    <Search size={32} />
                  </div>
                  <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">找不到符合的紀錄</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400">請嘗試不同的關鍵字或標籤篩選</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-32">
                  {sortedFilteredSales.map((sale) => {
                    const item = items.find(i => i.id === sale.item_id);
                    const order = orders.find(o => o.id === item?.order_id);
                    const saleDate = sale.created_at ? sale.created_at.slice(0, 10) : '';
                    const isSelected = selectedIds.includes(sale.id);

                    return (
                      <div
                        key={sale.id}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleSelection(sale.id);
                          }
                        }}
                        className={`p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border flex justify-between items-center transition-all duration-200 ${
                          isSelectMode ? 'cursor-pointer' : ''
                        } ${
                          isSelected 
                            ? 'bg-secondary-light/10 border-secondary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-secondary-dark/10' 
                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/80 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* 圓圈 Checkbox */}
                          {isSelectMode && (
                            <div 
                              className="shrink-0 mr-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelection(sale.id)}
                                className="w-4.5 h-4.5 rounded-none border-gray-300 dark:border-gray-600 text-secondary focus:ring-secondary accent-secondary cursor-pointer"
                              />
                            </div>
                          )}

                          {/* 圖片預覽 */}
                          {sale.image ? (
                            <div className="relative w-11 h-11 shrink-0 rounded-none overflow-hidden border-2 border-black">
                              <img 
                                src={sale.image} 
                                alt={item?.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.classList.add('hidden');
                                  e.currentTarget.nextSibling.classList.remove('hidden');
                                  e.currentTarget.nextSibling.classList.add('flex');
                                }}
                              />
                              <div className="hidden w-full h-full bg-red-50/50 dark:bg-red-950/20 text-red-500 dark:text-red-400 items-center justify-center">
                                <ImageIcon size={20} />
                              </div>
                            </div>
                          ) : item?.image ? (
                            <div className="relative w-11 h-11 shrink-0 rounded-none overflow-hidden border-2 border-black">
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.classList.add('hidden');
                                  e.currentTarget.nextSibling.classList.remove('hidden');
                                  e.currentTarget.nextSibling.classList.add('flex');
                                }}
                              />
                              <div className="hidden w-full h-full bg-red-50/50 dark:bg-red-950/20 text-red-500 dark:text-red-400 items-center justify-center">
                                <ImageIcon size={20} />
                              </div>
                            </div>
                          ) : (
                            <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-450 rounded-none flex items-center justify-center shrink-0">
                              <DollarSign size={20} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{item?.name || '未知物品'}</h3>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>數量: {sale.quantity} 件</span>
                              {sale.buyer_id && <span className="text-gray-500 dark:text-gray-400">| {sale.buyer_id}</span>}
                              {saleDate && <span>| {saleDate}</span>}
                            </p>
                            {order && (
                              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-1">
                                來自訂單: {order.source}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1.5 ml-2">
                          <span className="text-base font-black text-secondary-dark dark:text-secondary">
                            +NT$ {sale.price.toLocaleString()}
                          </span>
                          {/* 操作按鈕 (編輯 & 刪除，選取模式下隱藏) */}
                          {!isSelectMode && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item) {
                                    const itemSales = sales.filter(s => s.item_id === item.id);
                                    const soldQty = itemSales.reduce((sum, s) => sum + s.quantity, 0);
                                    const remainingQty = Math.max(0, item.quantity - soldQty);
                                    
                                    setSelectedSaleToEdit({
                                      sale,
                                      item,
                                      remainingQty
                                    });
                                  }
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-secondary-dark dark:hover:text-secondary p-1.5 rounded-none transition-colors hover:bg-emerald-50 dark:hover:bg-gray-700/50"
                                title="編輯紀錄"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm('確定要刪除這筆售出紀錄嗎？這將會恢復該物品的剩餘庫存。')) {
                                    try {
                                      await db.sales.delete(sale.id);
                                    } catch (error) {
                                      console.error('刪除售出紀錄失敗:', error);
                                      alert('刪除失敗，請重試');
                                    }
                                  }
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-red-500 p-1.5 rounded-none transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                                title="刪除紀錄"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      ) : viewMode === 'items' ? (
        // --- 物品清單模式 ---
        <div className="space-y-4">
          {/* 搜尋與時間排序組合 */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋商品名稱、角色、訂單名稱或來源..."
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 排序按鈕 */}
            <button
              type="button"
              onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-black text-gray-700 dark:text-gray-200 font-bold text-xs rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-1 shrink-0 select-none active:scale-95 transition-all duration-200"
              title={dateSort === 'desc' ? '由新到舊排序' : '由舊到新排序'}
            >
              <span>{dateSort === 'desc' ? '新➔舊' : '舊➔新'}</span>
            </button>

            {/* 選取按鈕 */}
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedIds([]);
              }}
              className={`px-3 py-2.5 font-bold text-xs rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1.5 shrink-0 select-none active:scale-95 ${
                isSelectMode
                  ? 'bg-gray-750 text-gray-200 border border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-primary-light/50 dark:bg-primary-dark/20 text-primary-dark dark:text-primary-light hover:bg-primary-light dark:hover:bg-primary-dark/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shadow-primary/5'
              }`}
            >
              <span>{isSelectMode ? '取消' : '選取'}</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-10 transition-colors">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-300 dark:text-blue-500 rounded-none flex items-center justify-center mb-4">
                <Boxes size={32} />
              </div>
              <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">物品清單空空如也</h3>
              <p className="text-sm text-gray-400 dark:text-gray-400">新增週邊物品時，就會在這裡列出喔！</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-10 transition-colors">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-500 rounded-none flex items-center justify-center mb-4">
                <Search size={32} />
              </div>
              <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">找不到符合的物品</h3>
              <p className="text-sm text-gray-400 dark:text-gray-400">請嘗試不同的關鍵字篩選</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-32">
              {filteredItems.map(item => {
                const associatedOrder = orders?.find(o => o.id === item.order_id);
                const exchangeRate = associatedOrder ? Number(associatedOrder.exchange_rate) : 1;
                const costTWD = item.twd_net_cost !== undefined 
                  ? item.twd_net_cost 
                  : Math.round(Number(item.price || 0) * exchangeRate);

                const itemRoles = getItemRoles(item);
                const statusInfo = getStatusStyle(item.status || associatedOrder?.status || '已喊單');
                const orderTitle = associatedOrder?.title || associatedOrder?.source || '未知訂單';

                const isSelected = selectedIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleSelection(item.id);
                      } else {
                        onOrderClick && onOrderClick(item.order_id);
                      }
                    }}
                    className={`p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border flex items-center justify-between transition-all duration-200 ${
                      isSelectMode ? 'cursor-pointer' : ''
                    } ${
                      isSelected 
                        ? 'bg-primary-light/10 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-primary-dark/10' 
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/80 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* 圓圈 Checkbox */}
                      {isSelectMode && (
                        <div 
                          className="shrink-0 mr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(item.id)}
                            className="w-4.5 h-4.5 rounded-none border-gray-300 dark:border-gray-600 text-primary focus:ring-primary accent-primary cursor-pointer"
                          />
                        </div>
                      )}

                      {item.image ? (
                        <div className="w-12 h-12 shrink-0 rounded-none overflow-hidden border border-gray-100 dark:border-gray-750">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-primary-light/35 dark:bg-primary-dark/20 text-primary dark:text-primary-light rounded-none flex items-center justify-center shrink-0">
                          <PackageOpen size={22} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                          {item.name}
                        </h4>
                        
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                          <span>數量: {item.quantity}</span>
                          <span>|</span>
                          <span className="truncate">來自: {orderTitle}</span>
                        </div>

                        {(item.source_type || itemRoles.length > 0 || (item.tags && item.tags.length > 0)) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.source_type && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold shrink-0 border ${
                                item.source_type === 'official'
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-100/50 dark:border-amber-900/50'
                                  : 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-100/50 dark:border-purple-900/50'
                              }`}>
                                {item.source_type === 'official' ? '官方' : `同人 (${item.fan_source || '未註明'})`}
                              </span>
                            )}
                            {itemRoles.map(r => (
                              <span key={r} className="text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                                {r}
                              </span>
                            ))}
                            {(item.tags || []).map(t => (
                              <span key={t} className="text-[9px] bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-1.5 py-0.5 rounded font-bold shrink-0">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                      <span className="font-black text-gray-800 dark:text-gray-100 text-sm">
                        NT$ {costTWD.toLocaleString()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-none font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${statusInfo.color}`}>
                        {statusInfo.dot} {statusInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'gallery' ? (
        // --- 圖牆模式 ---
        <div className="space-y-4">
          {/* 搜尋與時間排序組合 */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋商品名稱、角色、訂單名稱或來源..."
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 排序按鈕 */}
            <button
              type="button"
              onClick={() => setDateSort(dateSort === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-black text-gray-700 dark:text-gray-200 font-bold text-xs rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-1 shrink-0 select-none active:scale-95 transition-all duration-200"
              title={dateSort === 'desc' ? '由新到舊排序' : '由舊到新排序'}
            >
              <span>{dateSort === 'desc' ? '新➔舊' : '舊➔新'}</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-10 transition-colors">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-300 dark:text-blue-500 rounded-none flex items-center justify-center mb-4">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">圖牆空空如也</h3>
              <p className="text-sm text-gray-400 dark:text-gray-400">新增物品時，就會顯示在這裡喔！</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black p-8 flex flex-col items-center justify-center text-center mt-10 transition-colors">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-500 rounded-none flex items-center justify-center mb-4">
                <Search size={32} />
              </div>
              <h3 className="text-gray-800 dark:text-gray-100 font-bold mb-1">找不到符合的物品</h3>
              <p className="text-sm text-gray-400 dark:text-gray-400">請嘗試不同的關鍵字或標籤篩選</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 min-[768px]:grid-cols-4 min-[1080px]:grid-cols-6 gap-4 pb-32">
              {filteredItems.map(item => {
                const associatedOrder = orders?.find(o => o.id === item.order_id);
                const currencySymbol = associatedOrder 
                  ? (CURRENCIES.find(c => c.code === associatedOrder.currency)?.symbol || '$')
                  : '$';
                const totalForeignPrice = Number(item.price) * Number(item.quantity);
                const exchangeRate = associatedOrder ? Number(associatedOrder.exchange_rate) : 1;
                const totalTWDPrice = Math.round(totalForeignPrice * exchangeRate);

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="aspect-square bg-white dark:bg-gray-800 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black overflow-hidden relative cursor-pointer group hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-[0.98]"
                  >
                    {item.image ? (
                      <div className="w-full h-full relative">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover animate-in fade-in" 
                          onError={(e) => {
                            e.currentTarget.classList.add('hidden');
                            e.currentTarget.nextSibling.classList.remove('hidden');
                            e.currentTarget.nextSibling.classList.add('flex');
                          }}
                        />
                        <div className="hidden w-full h-full flex-col items-center justify-center bg-red-50/50 dark:bg-red-950/20 text-red-500 dark:text-red-400">
                          <ImageIcon size={32} className="mb-2 opacity-50" />
                          <span className="text-xs font-bold text-red-400 dark:text-red-300">圖片失效</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-300 dark:text-indigo-500">
                        <ImageIcon size={32} className="mb-2 opacity-50" />
                        <span className="text-xs font-bold text-indigo-400 dark:text-indigo-300">{(item.tags && item.tags[0]) || item.tag || '物品'}</span>
                      </div>
                    )}
                    {/* 遮罩標籤 */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-3 pt-12">
                      <h4 className="text-white text-xs font-black truncate">{item.name}</h4>
                      {(() => {
                        const itemRoles = getItemRoles(item);
                        return itemRoles.length > 0 && (
                          <p className="text-white/80 text-[10px] truncate">
                            {itemRoles.join(', ')}
                          </p>
                        );
                      })()}
                      {/* 數量與總金額 */}
                      <div className="flex justify-between items-center mt-1 text-[9px] text-white/90 font-bold">
                        <span>x{item.quantity}</span>
                        <span>
                          {currencySymbol}{totalForeignPrice.toLocaleString()}
                          NT$ {totalTWDPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* 底部玻璃質感懸浮對帳/總計條 */}
      {isSelectMode && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 md:left-[calc(50%+128px)] -translate-x-1/2 w-full max-w-md px-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-[#FFE66D] text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between gap-4 transition-colors">
            <div className="min-w-0">
              <span className="text-[10px] font-black text-black uppercase tracking-wider block">
                已選取對帳項目
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-sm font-black text-gray-800 dark:text-gray-100">
                  {selectedIds.length} 筆
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  合計 NT$
                </span>
                <span className={`text-base font-black ${(viewMode === 'items' || listType === 'expenses') ? 'text-primary dark:text-primary-light' : 'text-secondary-dark dark:text-secondary'}`}>
                  {totalSelectedAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 全選/取消全選按鈕 */}
              <button
                type="button"
                onClick={() => {
                  const currentFilteredListSize = viewMode === 'items' 
                    ? filteredItems.length 
                    : (listType === 'expenses' ? filteredOrders.length : filteredSales.length);
                  
                  if (selectedIds.length === currentFilteredListSize && currentFilteredListSize > 0) {
                    setSelectedIds([]);
                  } else {
                    if (viewMode === 'items') {
                      setSelectedIds(filteredItems.map(item => item.id));
                    } else {
                      handleSelectAll();
                    }
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-none transition-all active:scale-95 border border-gray-200/30 dark:border-gray-700/30"
              >
                {(() => {
                  const currentFilteredListSize = viewMode === 'items' 
                    ? filteredItems.length 
                    : (listType === 'expenses' ? filteredOrders.length : filteredSales.length);
                  return selectedIds.length === currentFilteredListSize && currentFilteredListSize > 0 ? '取消全選' : '全選當前';
                })()}
              </button>

              {/* 關閉選取模式 */}
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds([]);
                }}
                className="p-1.5 bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-none transition-all active:scale-95 border border-gray-200/30 dark:border-gray-700/30"
                title="關閉選取"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 物品詳細資訊 Modal (支援左右滑動與箭頭按鈕切換上一組/下一組圖片) */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* 畫面左側切換按鈕 (上一組 / 上一張) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevImageOrItem();
            }}
            className="fixed left-2 md:left-6 top-1/2 -translate-y-1/2 bg-[#FFE66D] text-black border-4 border-black font-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] active:scale-95 transition-all cursor-pointer z-[130]"
            title="上一組 / 上一張 (鍵盤 ← 左鍵)"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>

          {/* 畫面右側切換按鈕 (下一組 / 下一張) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNextImageOrItem();
            }}
            className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 bg-[#FFE66D] text-black border-4 border-black font-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] active:scale-95 transition-all cursor-pointer z-[130]"
            title="下一組 / 下一張 (鍵盤 → 右鍵)"
          >
            <ChevronRight size={24} strokeWidth={3} />
          </button>

          <div className="bg-white dark:bg-gray-900 w-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative max-h-[85vh] md:max-h-[90vh] md:max-w-xl flex flex-col">
            {/* 頂部標題與關閉列 */}
            <div className="px-5 py-4 bg-[#FFE66D] text-black border-b-4 border-black flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {(() => {
                  const currentList = filteredItems && filteredItems.length > 0 ? filteredItems : items;
                  const currentIdx = currentList.findIndex(i => i.id === selectedItem.id);
                  return currentIdx !== -1 ? (
                    <span className="bg-[#4ECDC4] text-black font-black text-xs px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      物品 {currentIdx + 1} / {currentList.length}
                    </span>
                  ) : null;
                })()}
                <span className="font-black uppercase text-sm truncate max-w-[200px] md:max-w-[280px]">
                  {selectedItem.name}
                </span>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-1.5 bg-[#FF6B6B] text-white border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF6B6B]/90 transition-colors cursor-pointer"
                title="關閉"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6 pb-safe space-y-6">
              {/* 大圖展示與輪播 */}
              {(() => {
                const itemImages = selectedItem.images && Array.isArray(selectedItem.images)
                  ? selectedItem.images
                  : (selectedItem.image ? [selectedItem.image] : []);
                
                return (
                  <div className="space-y-3">
                    <div className="aspect-square bg-[#f7f1df] dark:bg-gray-800 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center relative group">
                      {itemImages.length > 0 ? (
                        <div className="w-full h-full relative">
                          {isUrl(itemImages[activeImgIndex]) ? (
                            <img 
                              src={itemImages[activeImgIndex]} 
                              alt={`${selectedItem.name}-${activeImgIndex}`} 
                              className="w-full h-full object-contain absolute inset-0 cursor-zoom-in" 
                              onClick={() => setZoomImage(itemImages[activeImgIndex])}
                              onError={(e) => {
                                e.currentTarget.classList.add('hidden');
                                e.currentTarget.nextSibling.classList.remove('hidden');
                                e.currentTarget.nextSibling.classList.add('flex');
                              }}
                            />
                          ) : (
                            <img 
                              src={itemImages[activeImgIndex]} 
                              alt={`${selectedItem.name}-${activeImgIndex}`} 
                              className="w-full h-full object-contain absolute inset-0 cursor-zoom-in" 
                              onClick={() => setZoomImage(itemImages[activeImgIndex])}
                            />
                          )}
                          
                          <div className="hidden w-full h-full flex-col items-center justify-center bg-[#F38181] text-black font-black border-2 border-black">
                            <ImageIcon size={64} className="mb-3" />
                            <span className="font-black text-sm uppercase">圖片連結失效</span>
                          </div>

                          {/* 頁碼小標籤 */}
                          {itemImages.length > 1 && (
                            <div className="absolute bottom-3 right-3 bg-black text-white font-mono text-xs px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,230,109,1)] font-black z-10">
                              {activeImgIndex + 1} / {itemImages.length}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-black dark:text-gray-300 font-black">
                          <ImageIcon size={64} className="mb-3" />
                          <span className="text-xs uppercase font-mono">
                            {(selectedItem.tags && selectedItem.tags[0]) || selectedItem.tag || '無圖片'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 縮圖導覽列 */}
                    {itemImages.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none justify-center">
                        {itemImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveImgIndex(idx)}
                            className={`w-12 h-12 border-2 border-black transition-all shrink-0 bg-white ${
                              idx === activeImgIndex 
                                ? 'bg-[#FFE66D] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105' 
                                : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt={`縮圖-${idx}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 資訊區塊 */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {selectedItem.source_type && (
                      <span className="text-xs px-2.5 py-0.5 bg-[#4ECDC4] text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        {selectedItem.source_type === 'official' ? '官方' : `同人 (${selectedItem.fan_source || '未註明'})`}
                      </span>
                    )}
                    {getItemIps(selectedItem).map((ipName, idx) => (
                      <span key={idx} className="text-xs bg-[#FFE66D] text-black font-black px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        {ipName}
                      </span>
                    ))}
                    {(() => {
                      const itemTags = selectedItem.tags && Array.isArray(selectedItem.tags)
                        ? selectedItem.tags
                        : (selectedItem.tag ? [selectedItem.tag] : []);
                      if (itemTags.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          {itemTags.map((t, idx) => (
                            <span 
                              key={idx} 
                              className="text-xs bg-[#95E1D3] text-black font-black px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <h2 className="text-2xl font-black text-black dark:text-white uppercase leading-tight">{selectedItem.name}</h2>
                  {(() => {
                    const itemRoles = getItemRoles(selectedItem);
                    if (itemRoles.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mt-2 items-center">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300 shrink-0">角色：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {itemRoles.map((role, idx) => (
                            <span 
                              key={idx} 
                              className="bg-[#FF6B6B] text-white border-2 border-black px-2.5 py-0.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FFE66D] text-black p-3.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-xs font-black uppercase mb-0.5">外幣單價 (PRICE)</p>
                    <p className="text-lg font-black font-mono">{selectedItem.price}</p>
                  </div>
                  <div className="bg-[#4ECDC4] text-black p-3.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-xs font-black uppercase mb-0.5">總數量 (QTY)</p>
                    <p className="text-lg font-black font-mono">{selectedItem.quantity} 件</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 編輯訂單表單 Modal */}
      {editingOrder && (
        <AddOrder existingOrder={editingOrder} onClose={() => setEditingOrder(null)} />
      )}

      {/* 編輯售出紀錄 Modal */}
      {selectedSaleToEdit && (
        <SellItem
          item={selectedSaleToEdit.item}
          remainingQty={selectedSaleToEdit.remainingQty}
          existingSale={selectedSaleToEdit.sale}
          onClose={() => setSelectedSaleToEdit(null)}
        />
      )}

      {/* 歸屬至訂單 Modal (支援單筆與多筆) */}
      {(assigningItem || assigningItems.length > 0) && (
        <AssignOrderModal 
          item={assigningItem}
          items={assigningItems} 
          onClose={() => {
            setAssigningItem(null);
            setAssigningItems([]);
          }}
          onSuccess={() => {
            setSelectedUnassignedIds([]);
          }} 
        />
      )}

      {/* 單獨新增/編輯物品 Modal */}
      {(isAddStandaloneOpen || editingStandaloneItem) && (
        <AddItem 
          existingItem={editingStandaloneItem} 
          onClose={() => {
            setIsAddStandaloneOpen(false);
            setEditingStandaloneItem(null);
          }} 
        />
      )}

      {/* 買家對帳單 Modal */}
      {isReconOpen && (
        <ReconciliationModal onClose={() => setIsReconOpen(false)} />
      )}

      {/* 圖片全螢幕放大 Lightbox (支援左右滑動與鍵盤/按鈕切換) */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-[140] bg-black/95 flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200"
        >
          {/* 左側箭頭按鈕 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevImageOrItem();
            }}
            className="fixed left-2 md:left-6 top-1/2 -translate-y-1/2 bg-[#FFE66D] text-black border-4 border-black font-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] active:scale-95 transition-all cursor-pointer z-[150]"
            title="上一張 / 上一組 (←)"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>

          {/* 右側箭頭按鈕 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNextImageOrItem();
            }}
            className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 bg-[#FFE66D] text-black border-4 border-black font-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] active:scale-95 transition-all cursor-pointer z-[150]"
            title="下一張 / 下一組 (→)"
          >
            <ChevronRight size={24} strokeWidth={3} />
          </button>

          {/* 關閉按鈕 */}
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 p-2 bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF6B6B]/90 transition-colors z-[150] cursor-pointer"
            title="關閉放大"
          >
            <X size={20} strokeWidth={3} />
          </button>

          {/* 頂部物品名稱與頁碼 */}
          {selectedItem && (
            <div className="absolute top-4 left-4 bg-[#FFE66D] text-black font-black text-xs px-3 py-1.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-[150] flex items-center gap-2">
              <span>{selectedItem.name}</span>
              {(() => {
                const currentList = filteredItems && filteredItems.length > 0 ? filteredItems : items;
                const currentIdx = currentList.findIndex(i => i.id === selectedItem.id);
                return currentIdx !== -1 ? (
                  <span className="bg-[#4ECDC4] px-2 py-0.5 border border-black">
                    {currentIdx + 1} / {currentList.length}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          <img 
            src={zoomImage} 
            alt="全螢幕放大圖片" 
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto m-auto object-contain select-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,230,109,1)] transition-all animate-in zoom-in-95 duration-200" 
          />
        </div>
      )}
    </div>
  );
}

