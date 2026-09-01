import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Sparkles, 
  Copy, Check, UserPlus, DollarSign, Calculator, Image as ImageIcon, Camera, X,
  Table, LayoutGrid, Download, Settings, Package
} from 'lucide-react';
import { db } from '../db';
import AddBoxSplitModal, { BOX_SPLIT_MODES } from './AddBoxSplitModal';
import { compressImage } from '../utils';
import { useHardwareBack } from '../hooks/useHardwareBack';

// ----------------------------------------------------------------------
// 區域錯誤捕捉元件 (防止 Sheet 視圖崩潰造成全頁白屏)
// ----------------------------------------------------------------------
class LocalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LocalErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 rounded-none border-2 border-red-300 text-center my-4 space-y-3">
          <h4 className="font-black text-base">⚠️ 表格視圖繪製時發生異常</h4>
          <p className="text-xs font-mono break-all">{this.state.error?.toString()}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 active:scale-95 transition-all"
          >
            重試載入
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ----------------------------------------------------------------------
// 配分引擎：根據模式 (time_first, amount_first, qty_first, allin_time_first)、品項庫存 (stock)
// 以及「無 A 則 Pass」條件進行多輪疊代配分解算
// ----------------------------------------------------------------------
export function computeSplitAllocations(split, items = [], participants = [], getItemUnitPrice) {
  const mode = split?.mode || 'time_first';
  const allocatedMap = new Map(); // participantId -> allocatedQty
  const passTriggeredSet = new Set(); // participantId -> boolean (是否因無 A 則 Pass 條件被取消喊單)

  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const safeParticipants = Array.isArray(participants) ? participants.filter(Boolean) : [];

  let activeParticipants = [...safeParticipants];

  // 多輪疊代計算 (最高 10 輪確保收斂)
  for (let iter = 0; iter < 10; iter++) {
    // 1. 計算當前活性參與者的買家全團消費額與全團數量
    const buyerTotalSpend = new Map();
    const buyerTotalQty = new Map();

    activeParticipants.forEach(p => {
      if (!p || !p.buyer_name) return;
      const item = safeItems.find(i => i && i.id === p.item_id);
      if (item && typeof getItemUnitPrice === 'function') {
        const singleUnitPrice = getItemUnitPrice(item);
        const spend = Math.round(singleUnitPrice * (Number(p.qty) || 1));

        buyerTotalSpend.set(p.buyer_name, (buyerTotalSpend.get(p.buyer_name) || 0) + spend);
        buyerTotalQty.set(p.buyer_name, (buyerTotalQty.get(p.buyer_name) || 0) + (Number(p.qty) || 1));
      }
    });

    // 2. 清空當輪配分映射
    allocatedMap.clear();

    // 3. 針對每個品項分配庫存
    safeItems.forEach(item => {
      if (!item) return;
      const stock = Number(item.stock) || 1;
      let remainingStock = stock;

      let itemParts = activeParticipants.filter(p => p && p.item_id === item.id);

      itemParts.sort((a, b) => {
        if (!a || !b) return 0;
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        const bNameA = a.buyer_name || '';
        const bNameB = b.buyer_name || '';

        if (mode === 'allin_time_first') {
          if (a.is_allin && !b.is_allin) return -1;
          if (!a.is_allin && b.is_allin) return 1;
          const spendA = buyerTotalSpend.get(bNameA) || 0;
          const spendB = buyerTotalSpend.get(bNameB) || 0;
          if (spendB !== spendA) return spendB - spendA;
          return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (idA - idB);
        } else if (mode === 'amount_first') {
          const spendA = buyerTotalSpend.get(bNameA) || 0;
          const spendB = buyerTotalSpend.get(bNameB) || 0;
          if (spendB !== spendA) return spendB - spendA;
          const qtyA = buyerTotalQty.get(bNameA) || 0;
          const qtyB = buyerTotalQty.get(bNameB) || 0;
          if (qtyB !== qtyA) return qtyB - qtyA;
          return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (idA - idB);
        } else if (mode === 'qty_first') {
          const qtyA = buyerTotalQty.get(bNameA) || 0;
          const qtyB = buyerTotalQty.get(bNameB) || 0;
          if (qtyB !== qtyA) return qtyB - qtyA;
          const spendA = buyerTotalSpend.get(bNameA) || 0;
          const spendB = buyerTotalSpend.get(bNameB) || 0;
          if (spendB !== spendA) return spendB - spendA;
          return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (idA - idB);
        } else {
          return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (idA - idB);
        }
      });

      itemParts.forEach(p => {
        if (!p) return;
        if (remainingStock > 0) {
          const take = Math.min(remainingStock, Number(p.qty) || 1);
          allocatedMap.set(p.id, take);
          remainingStock -= take;
        } else {
          allocatedMap.set(p.id, 0);
        }
      });
    });

    // 4. 檢查是否有活躍參與者觸發「無 A 則 Pass」條件
    let newlyCancelledIds = new Set();

    activeParticipants.forEach(p => {
      if (p && p.pass_rule && p.pass_rule !== 'none' && p.pass_trigger_item_id) {
        // 檢查該買家是否在「品項 A (pass_trigger_item_id)」獲得中選額度
        const triggerClaims = activeParticipants.filter(x => x && x.buyer_name === p.buyer_name && x.item_id === Number(p.pass_trigger_item_id));
        const totalTriggerAllocated = triggerClaims.reduce((sum, x) => sum + (allocatedMap.get(x.id) || 0), 0);

        if (triggerClaims.length > 0 && totalTriggerAllocated === 0) {
          // 條件成立：買家未中選品項 A！執行 Pass
          if (p.pass_rule === 'pass_all') {
            // 忽略該買家在全團的所有喊單
            activeParticipants.filter(x => x && x.buyer_name === p.buyer_name).forEach(x => {
              newlyCancelledIds.add(x.id);
              passTriggeredSet.add(x.id);
            });
          } else if (p.pass_rule === 'pass_item' && p.pass_target_item_id) {
            // 僅忽略該買家在特定品項 B (pass_target_item_id) 的喊單
            activeParticipants.filter(x => x && x.buyer_name === p.buyer_name && x.item_id === Number(p.pass_target_item_id)).forEach(x => {
              newlyCancelledIds.add(x.id);
              passTriggeredSet.add(x.id);
            });
          }
        }
      }
    });

    if (newlyCancelledIds.size === 0) {
      break; // 已達穩定解！
    }

    // 將被 Pass 的喊單剔除後進行下一輪重新配分
    activeParticipants = activeParticipants.filter(p => p && !newlyCancelledIds.has(p.id));
  }

  // 確保未在配分表中的原始參團紀錄都設為 0
  safeParticipants.forEach(p => {
    if (p && p.id != null && !allocatedMap.has(p.id)) {
      allocatedMap.set(p.id, 0);
    }
  });

  return { allocatedMap, passTriggeredSet };
}

export default function BoxSplitDetail({ splitId, onBack }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [activeItemIdForParticipant, setActiveItemIdForParticipant] = useState(null);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [copiedBuyer, setCopiedBuyer] = useState(null);

  // 視圖切換狀態：電腦版預設 'sheet' (Sheet 表格試算表視圖)，手機版預設 'card' (卡片視圖)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return 'sheet';
    }
    return 'card';
  });

  // 讀取拆團主表
  const split = useLiveQuery(() => db.box_splits.get(Number(splitId)), [splitId]);
  // 讀取拆團品項 (種類)
  const items = useLiveQuery(
    () => db.box_split_items ? db.box_split_items.where('box_split_id').equals(Number(splitId)).sortBy('sort_order') : Promise.resolve([]),
    [splitId]
  ) || [];
  // 讀取所有參團人員
  const participants = useLiveQuery(
    () => db.box_split_participants ? db.box_split_participants.where('box_split_id').equals(Number(splitId)).toArray() : Promise.resolve([]),
    [splitId]
  ) || [];
  // 讀取角色排序庫
  const characterOrders = useLiveQuery(
    () => db.character_sort_orders ? db.character_sort_orders.orderBy('sort_order').toArray() : Promise.resolve([]),
    []
  ) || [];

  useHardwareBack(true, onBack, 'box-split-detail');

  // 拆團總金額 (T) 手動更新 handler
  const handleUpdateTotalAmount = async (val) => {
    const amount = Number(val) || 0;
    await db.box_splits.update(Number(splitId), { total_amount: amount });
  };

  const handleUpdateSecondShipping = async (val) => {
    const fee = Number(val) || 0;
    await db.box_splits.update(Number(splitId), { second_shipping_fee: fee });
  };

  // 算式計算：單二補金額 (總二補金額 / 種類總數)
  const totalSecondShipping = Number(split?.second_shipping_fee) || 0;
  const itemCount = items.length || 1;
  const unitSecondShipping = totalSecondShipping > 0 ? Math.round(totalSecondShipping / itemCount) : 0;

  // 熱度調價價差模式 (spread_mode / price_adjust_type)
  const spreadMode = split?.spread_mode || split?.price_adjust_type || 'none';

  // 算式計算：基準平均單價 (拆團總金額 / 種類總數量)
  const totalBoxAmount = Number(split?.total_amount) || 0;
  const totalStock = items.reduce((sum, i) => sum + (Number(i.stock) || 1), 0) || 1;
  const baseAvg = totalBoxAmount > 0 ? (totalBoxAmount / totalStock) : 50;

  // 熱度調價階梯映射表 (四步演算法：有效均價 -> 權重 W[i] -> 步長 5 取整 -> 殘差修補)
  const adjustedPriceMap = React.useMemo(() => {
    if (!items || items.length === 0) return new Map();
    const map = new Map();
    const N = items.length;
    const step = 5; // 步長 5 元

    if (spreadMode === 'none' || !spreadMode) {
      const avg = Math.round(baseAvg);
      items.forEach(item => map.set(item.id, avg));
      return map;
    }

    // 步驟 1：有效平均單價 avg_price = baseAvg
    const avg_price = baseAvg;

    // 步驟 2：建立權重 W[i]
    const midOffset = (N - 1) / 2.0;
    let W = [];

    if (spreadMode === 'low') {
      // 1. low (極小價差): 線性分佈 scale = 0.5
      W = items.map((_, i) => (midOffset - i) * 0.5);
    } else if (spreadMode === 'balanced' || spreadMode === 'normal') {
      // 2. balanced (標準階梯): 線性分佈 scale = 1.0
      W = items.map((_, i) => (midOffset - i) * 1.0);
    } else if (spreadMode === 'high' || spreadMode === 'aggressive') {
      // 3. high (大價差/熱門高承擔): 非線性次方分佈 (Power Curve)
      W = items.map((_, i) => {
        if (midOffset === 0) return 0;
        const x = (midOffset - i) / midOffset; // 區間 [-1.0, 1.0]
        const signX = Math.sign(x);
        const absX = Math.abs(x);
        return signX * Math.pow(absX, 1.6) * midOffset * 2.0;
      });
    }

    // 步驟 3：通用公式 raw_price[i] = avg_price + (W[i] * step)
    // quantized_price[i] = round(raw_price / step) * step
    const priceObjects = items.map((item, i) => {
      const raw_price = avg_price + (W[i] * step);
      const quantized_price = Math.max(5, Math.round(raw_price / step) * step);
      return { id: item.id, qty: Number(item.stock) || 1, price: quantized_price };
    });

    // 步驟 4：殘差修補 (Greedy Residual Adjustment) 確保總和無落差 (防死迴圈機制)
    const targetTotal = Number(totalBoxAmount) || 0;
    if (targetTotal > 0 && priceObjects.length > 0) {
      let currentSum = priceObjects.reduce((sum, p) => sum + p.price * p.qty, 0);
      let residual = targetTotal - currentSum; // R = T - sum(P_i * Q_i)

      let maxSafetyCounter = 100; // 最多執行 100 次
      if (residual >= step) {
        let idx = 0;
        while (residual >= step && maxSafetyCounter-- > 0) {
          priceObjects[idx].price += step;
          residual -= priceObjects[idx].qty * step;
          idx = (idx + 1) % N;
        }
      } else if (residual <= -step) {
        let idx = N - 1;
        let stagnateCounter = 0;
        while (residual <= -step && maxSafetyCounter-- > 0 && stagnateCounter < N) {
          if (priceObjects[idx].price - step >= 5) {
            priceObjects[idx].price -= step;
            residual += priceObjects[idx].qty * step;
            stagnateCounter = 0;
          } else {
            stagnateCounter++;
          }
          idx = (idx - 1 + N) % N;
        }
      }
    }

    priceObjects.forEach(p => map.set(p.id, p.price));
    return map;
  }, [items, totalBoxAmount, spreadMode, baseAvg]);

  // 計算特定品項種類單價 (自訂單價 > 倍率 > 熱度調價 > 均價)
  const getItemUnitPrice = React.useCallback((item) => {
    if (!item) return 0;
    if (item.manual_price !== undefined && item.manual_price !== null && item.manual_price !== '') {
      return Number(item.manual_price) || 0;
    }
    if (split?.use_multiplier) {
      const mult = Number(item.price_multiplier) || 1.0;
      return Math.round(baseAvg * mult);
    }
    return adjustedPriceMap.get(item.id) ?? Math.round(baseAvg);
  }, [adjustedPriceMap, baseAvg, split?.use_multiplier]);

  // 拆團總金額：由所有品項金額加總求得
  const calculatedTotalAmount = React.useMemo(() => {
    if (!items || items.length === 0) return totalBoxAmount;
    return items.reduce((sum, item) => sum + (getItemUnitPrice(item) * (Number(item.stock) || 1)), 0);
  }, [items, totalBoxAmount, getItemUnitPrice]);

  // 切換熱度調價模式 handler
  const handleTogglePriceAdjust = async (type) => {
    await db.box_splits.update(Number(splitId), { spread_mode: type, price_adjust_type: type });
  };

  const currentModeInfo = BOX_SPLIT_MODES.find(m => m.id === split?.mode) || BOX_SPLIT_MODES[0];

  // 計算參團配分 (使用 useMemo 快取防止每次打字重複大量算式渲染)
  const { allocatedMap, passTriggeredSet } = React.useMemo(() => {
    return computeSplitAllocations(split, items, participants, getItemUnitPrice);
  }, [split, items, participants, getItemUnitPrice]);

  if (!split) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>載入中或拆團不存在...</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-none text-xs font-bold">
          返回列表
        </button>
      </div>
    );
  }

  // 依據全域角色排序庫自動排列品項
  const handleAutoSortByLibrary = async () => {
    if (items.length === 0) return;
    if (characterOrders.length === 0) {
      alert('ℹ️ 角色排序庫目前為空，請先至排序庫新增角色優先順序！');
      return;
    }

    // 建立角色名 -> sort_order 映射
    const orderMap = new Map();
    characterOrders.forEach(c => {
      orderMap.set(c.name.toLowerCase(), c.sort_order);
    });

    const sortedList = [...items].sort((a, b) => {
      const orderA = orderMap.has(a.name.toLowerCase()) ? orderMap.get(a.name.toLowerCase()) : 9999;
      const orderB = orderMap.has(b.name.toLowerCase()) ? orderMap.get(b.name.toLowerCase()) : 9999;
      return orderA - orderB;
    });

    await db.transaction('rw', db.box_split_items, async () => {
      for (let idx = 0; idx < sortedList.length; idx++) {
        await db.box_split_items.update(sortedList[idx].id, { sort_order: idx + 1 });
      }
    });

    alert('已成功依照角色排序庫重新排列品項順序！');
  };

  // 上移品項
  const handleMoveItemUp = async (index) => {
    if (index === 0) return;
    const current = items[index];
    const prev = items[index - 1];
    await db.transaction('rw', db.box_split_items, async () => {
      await db.box_split_items.update(current.id, { sort_order: prev.sort_order });
      await db.box_split_items.update(prev.id, { sort_order: current.sort_order });
    });
  };

  // 下移品項
  const handleMoveItemDown = async (index) => {
    if (index === items.length - 1) return;
    const current = items[index];
    const next = items[index + 1];
    await db.transaction('rw', db.box_split_items, async () => {
      await db.box_split_items.update(current.id, { sort_order: next.sort_order });
      await db.box_split_items.update(next.id, { sort_order: current.sort_order });
    });
  };

  // 直接設定特定品項的熱度排名 (1-indexed)
  const handleSetItemRank = async (currentIndex, targetRank) => {
    const newRank = Math.max(1, Math.min(items.length, Number(targetRank) || 1));
    const targetIndex = newRank - 1;
    if (currentIndex === targetIndex) return;

    const list = [...items];
    const [movedItem] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    await db.transaction('rw', db.box_split_items, async () => {
      for (let idx = 0; idx < list.length; idx++) {
        await db.box_split_items.update(list[idx].id, { sort_order: idx + 1 });
      }
    });
  };

  // 刪除品項
  const handleDeleteItem = async (itemId) => {
    if (window.confirm('確定要刪除此品項種類嗎？該品項下的喊單紀錄也會一併刪除。')) {
      await db.transaction('rw', db.box_split_items, db.box_split_participants, async () => {
        await db.box_split_items.delete(itemId);
        await db.box_split_participants.where('item_id').equals(itemId).delete();
      });
    }
  };

  // 刪除參團人員喊單紀錄
  const handleDeleteParticipant = async (participantId) => {
    if (window.confirm('確定要刪除此參團人員的喊單紀錄嗎？')) {
      await db.box_split_participants.delete(participantId);
    }
  };

  // 複製單一買家對帳單
  const handleCopyBuyerBill = (buyerName) => {
    const buyerParts = participants.filter(p => p.buyer_name === buyerName);
    let totalItemsCost = 0;
    const lines = [];

    buyerParts.forEach(p => {
      const item = items.find(i => i.id === p.item_id);
      if (item) {
        const singleUnitPrice = getItemUnitPrice(item);
        const allocatedQty = allocatedMap.get(p.id) ?? 0;
        const subTotal = Math.round(singleUnitPrice * allocatedQty);

        if (allocatedQty > 0) {
          totalItemsCost += subTotal;
          lines.push(`- ${item.name} x${allocatedQty} : $${subTotal}`);
        } else {
          lines.push(`- ${item.name} x${p.qty} : $0 (未配到)`);
        }
      }
    });

    const allocatedKindsCount = buyerParts.filter(p => (allocatedMap.get(p.id) ?? 0) > 0).length;
    const buyerSecondShipping = unitSecondShipping * allocatedKindsCount;
    const finalTotal = totalItemsCost + buyerSecondShipping;

    let text = `【${split.title}】對帳單 - ${buyerName}\n`;
    text += `--------------------\n`;
    text += lines.join('\n') + '\n';
    text += `--------------------\n`;
    text += `品項小計：$${totalItemsCost}\n`;
    if (totalSecondShipping > 0) {
      text += `二補運費：$${buyerSecondShipping}\n`;
    }
    text += `應付總計：$${finalTotal}\n`;

    navigator.clipboard.writeText(text);
    setCopiedBuyer(buyerName);
    setTimeout(() => setCopiedBuyer(null), 2000);
    alert(`已複製 ${buyerName} 的對帳文案至剪貼簿！`);
  };

  // 匯出整個拆團總表為 CSV (可直接在 Excel / Google Sheets 開啟)
  const handleExportSheetCSV = () => {
    if (!split) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM 防中文亂碼
    csvContent += `【揪拆團總表 Sheet - ${split.title}】\n`;
    csvContent += `日期,${split.date || ''}\n`;
    csvContent += `優先模式,${currentModeInfo?.label || ''}\n`;
    csvContent += `拆團總金額,NT$ ${split.total_amount || 0}\n`;
    csvContent += `總二補金額,NT$ ${split.second_shipping_fee || 0}\n`;
    csvContent += `\n`;

    csvContent += `--- 品項種類與配分對帳表 ---\n`;
    csvContent += `序號,品項名稱,庫存/總數,種類單價,單件金額,已認領數,完售狀態,喊單與配分名單\n`;

    items.forEach((item, idx) => {
      const singleUnitPrice = getItemUnitPrice(item);
      const stock = Number(item.stock) || 1;
      const itemParts = participants.filter(p => p.item_id === item.id);
      const totalBoughtQty = itemParts.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
      const isSoldOut = totalBoughtQty >= stock;

      const claimantsStr = itemParts.map(p => {
        const allocatedQty = allocatedMap.get(p.id) ?? p.qty;
        const status = passTriggeredSet.has(p.id)
          ? '[無A則Pass]'
          : allocatedQty === 0
          ? '[候補]'
          : allocatedQty < p.qty
          ? `[配到x${allocatedQty}]`
          : `[得標x${allocatedQty}]`;
        return `${p.buyer_name}(喊x${p.qty} ${status})`;
      }).join('; ');

      const cleanItemName = (item.name || '').replace(/,/g, ' ');
      csvContent += `${idx + 1},"${cleanItemName}",${stock},${uPrice},${singleUnitPrice},${totalBoughtQty},${isSoldOut ? '完售' : '開放中'},"${claimantsStr}"\n`;
    });

    csvContent += `\n`;
    csvContent += `--- 參團買家對帳彙整表 ---\n`;
    csvContent += `買家ID/姓名,中選品項與數量,品項費用小計,二補運費,應付總金額\n`;

    const allBuyerNames = Array.from(new Set(participants.map(p => p.buyer_name))).filter(Boolean);
    allBuyerNames.forEach(bName => {
      const buyerParts = participants.filter(p => p.buyer_name === bName);
      let totalItemsCost = 0;
      let allocatedKindsCount = 0;
      const itemDetails = [];

      buyerParts.forEach(p => {
        const item = items.find(i => i.id === p.item_id);
        if (item) {
          const singleUnitPrice = getItemUnitPrice(item);
          const allocatedQty = allocatedMap.get(p.id) ?? 0;
          const subTotal = Math.round(singleUnitPrice * allocatedQty);

          if (allocatedQty > 0) {
            totalItemsCost += subTotal;
            allocatedKindsCount++;
            itemDetails.push(`${item.name} x${allocatedQty} ($${subTotal})`);
          }
        }
      });

      const buyerSecondShipping = unitSecondShipping * allocatedKindsCount;
      const finalTotal = totalItemsCost + buyerSecondShipping;
      const cleanBuyerName = bName.replace(/,/g, ' ');

      csvContent += `"${cleanBuyerName}","${itemDetails.join('; ')}",${totalItemsCost},${buyerSecondShipping},${finalTotal}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (split.title || '拆團總表').replace(/[\\/:*?"<>|]/g, '_');
    link.setAttribute('download', `CollectTrack_拆團Sheet_${safeTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 space-y-5 max-w-4xl mx-auto md:py-6 pb-32">
      
      {/* 一體成型頂部儀表板卡片 (俏皮野獸派大膽塊面與硬陰影) */}
      <div className="bg-white dark:bg-gray-800 rounded-none p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-black space-y-4">
        
        {/* Header 列：標題、返回與頂部主按鈕組 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-[#f7f1df] dark:bg-gray-700 text-black dark:text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE66D] active:scale-95 transition-all cursor-pointer shrink-0"
              title="返回拆團列表"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-black dark:text-white uppercase tracking-wider">{split.title}</h1>
                <span className="px-2.5 py-0.5 text-xs font-black bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {split.status}
                </span>
              </div>

              {/* 標籤 */}
              {split.tags && split.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {split.tags.map((t, idx) => (
                    <span key={idx} className="bg-[#4ECDC4] text-black text-[10px] font-black px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右上角主動作組 */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => setIsReconciliationOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer"
            >
              <DollarSign size={15} strokeWidth={2.5} />
              <span>對帳管家</span>
            </button>
            {viewMode === 'sheet' && (
              <button
                type="button"
                onClick={handleExportSheetCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#4ECDC4] hover:bg-teal-300 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer"
                title="匯出此拆團總表為 CSV 檔案 (可於 Excel / Google Sheets 開啟)"
              >
                <Download size={15} strokeWidth={2.5} />
                <span>匯出 CSV</span>
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-2 text-black dark:text-white bg-white dark:bg-gray-700 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              title="編輯拆團設定"
            >
              <Pencil size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 財務指標 Grid (三卡片欄位：總成本 / 均價 / 總二補) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. 拆團總成本 (T) */}
          <div className="bg-[#FFE66D] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
            <label className="text-[11px] font-black text-black uppercase tracking-wider block mb-1">
              拆團總成本金額 (自填 T)
            </label>
            <div className="flex items-center justify-between gap-1">
              <span className="font-black text-sm text-black">NT$</span>
              <input
                type="number"
                min="0"
                value={split.total_amount ?? ''}
                onChange={(e) => handleUpdateTotalAmount(e.target.value)}
                placeholder="0"
                className="w-28 bg-white border-2 border-black px-2 py-1 text-base font-mono font-black text-black text-right focus:outline-none shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          </div>

          {/* 2. 基準平均單價 */}
          <div className="bg-[#A8E6CF] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
            <span className="text-[11px] font-black text-black uppercase tracking-wider block mb-1">
              基準平均單價
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700">({totalStock} 件種類)</span>
              <span className="text-xl font-black font-mono text-black">NT$ {Math.round(baseAvg)}</span>
            </div>
          </div>

          {/* 3. 總二補金額與單二補 */}
          <div className="bg-[#95E1D3] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
            <label className="text-[11px] font-black text-black uppercase tracking-wider block mb-1">
              總二補金額 (單二補 ${unitSecondShipping})
            </label>
            <div className="flex items-center justify-between gap-1">
              <span className="font-black text-sm text-black">NT$</span>
              <input
                type="number"
                min="0"
                value={split.second_shipping_fee || ''}
                onChange={(e) => handleUpdateSecondShipping(e.target.value)}
                placeholder="0"
                className="w-28 bg-white border-2 border-black px-2 py-1 text-base font-mono font-black text-black text-right focus:outline-none shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          </div>
        </div>

        {/* 熱度價差模式控制與說明區塊 */}
        <div className="pt-2 space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-[#f7f1df] dark:bg-gray-750 p-2.5 border-2 border-black">
            <span className="text-xs font-black text-black dark:text-white uppercase shrink-0 flex items-center gap-1">
              <span>🔥</span>
              <span>熱度價差模式：</span>
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleTogglePriceAdjust('none')}
                className={`px-2.5 py-1 border-2 border-black text-xs font-black transition-all cursor-pointer ${
                  spreadMode === 'none'
                    ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 dark:bg-gray-700 dark:text-white'
                }`}
              >
                🚫 不調價
              </button>
              <button
                type="button"
                onClick={() => handleTogglePriceAdjust('low')}
                className={`px-2.5 py-1 border-2 border-black text-xs font-black transition-all cursor-pointer ${
                  spreadMode === 'low'
                    ? 'bg-[#A8E6CF] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 dark:bg-gray-700 dark:text-white'
                }`}
                title="極小價差 (low): 線性 scale=0.5，最高與最低價差控制在 20%~30% 以內"
              >
                📉 極小價差 (low)
              </button>
              <button
                type="button"
                onClick={() => handleTogglePriceAdjust('balanced')}
                className={`px-2.5 py-1 border-2 border-black text-xs font-black transition-all cursor-pointer ${
                  spreadMode === 'balanced' || spreadMode === 'normal'
                    ? 'bg-[#FFE66D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 dark:bg-gray-700 dark:text-white'
                }`}
                title="標準階梯 (balanced): 線性 scale=1.0，各階呈均勻等差遞減"
              >
                ⚖️ 標準階梯 (balanced)
              </button>
              <button
                type="button"
                onClick={() => handleTogglePriceAdjust('high')}
                className={`px-2.5 py-1 border-2 border-black text-xs font-black transition-all cursor-pointer ${
                  spreadMode === 'high' || spreadMode === 'aggressive'
                    ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black hover:bg-gray-100 dark:bg-gray-700 dark:text-white'
                }`}
                title="大價差 (high): 非線性 Power Curve 次方分佈，頂階高承擔、底階大幅折扣"
              >
                🔥 大價差 (high)
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-[11px] font-mono font-bold">
            <div className="flex-1 bg-gray-50 dark:bg-gray-700 p-2 border-2 border-black text-gray-700 dark:text-gray-200">
              {spreadMode === 'none' && '💡 均價模式：所有品項均價平攤，無熱度差價。'}
              {spreadMode === 'low' && '💡 極小價差 (low)：最高與最低價差精準控制在平均單價 20%~30% 以內。'}
              {(spreadMode === 'balanced' || spreadMode === 'normal') && '💡 標準階梯 (balanced)：各階呈均勻等差遞減，溫和分配價差。'}
              {(spreadMode === 'high' || spreadMode === 'aggressive') && '💡 大價差 (high)：頂階大幅拉高承擔、底階大幅打折，熱門高承擔。'}
            </div>
            <div className="bg-[#FFE66D] text-black p-2 border-2 border-black flex items-center gap-1.5 shrink-0">
              <Settings size={14} strokeWidth={2.5} />
              <span>優先規則：<strong>{currentModeInfo.label}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 主要檢視模式與工具控制列 */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`px-3.5 py-2 border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'sheet'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Table size={15} strokeWidth={2.5} />
              <span>Sheet 表格檢視</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3.5 py-2 border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutGrid size={15} strokeWidth={2.5} />
              <span>㗊 卡片檢視</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="flex items-center gap-1 text-xs font-black text-black bg-[#FFE66D] hover:bg-amber-300 border-2 border-black px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95 cursor-pointer"
              title="開啟自定義排序面板，調整各品項熱度高低"
            >
              <ArrowUpDown size={14} strokeWidth={2.5} />
              <span>⇅ 熱度排序</span>
            </button>
            <button
              onClick={handleAutoSortByLibrary}
              className="flex items-center gap-1 text-xs font-bold text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/50 hover:bg-purple-200 border-2 border-black px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95 cursor-pointer"
              title="點擊依全域角色排序庫自動排列品項"
            >
              <Sparkles size={14} />
              <span>依角色庫排序</span>
            </button>
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FF6B6B] hover:bg-red-500 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus size={16} strokeWidth={3} />
              <span>+ 新增種類</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'sheet' ? (
        /* Sheet 表格試算表視圖 */
        <LocalErrorBoundary>
          <BoxSplitSheetView
            split={split}
            items={items || []}
            participants={participants || []}
            allocatedMap={allocatedMap || new Map()}
            passTriggeredSet={passTriggeredSet || new Set()}
            getItemUnitPrice={getItemUnitPrice}
            unitSecondShipping={unitSecondShipping || 0}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsAddItemOpen(true);
            }}
            onDeleteItem={handleDeleteItem}
            onMoveItemUp={handleMoveItemUp}
            onMoveItemDown={handleMoveItemDown}
            onSetItemRank={handleSetItemRank}
            onAddParticipant={(itemId) => {
              setActiveItemIdForParticipant(itemId);
              setIsAddParticipantOpen(true);
            }}
            onEditParticipant={(p, itemId) => {
              setEditingParticipant(p);
              setActiveItemIdForParticipant(itemId);
              setIsAddParticipantOpen(true);
            }}
            onDeleteParticipant={handleDeleteParticipant}
            onCopyReconciliation={handleCopyBuyerBill}
          />
        </LocalErrorBoundary>
      ) : (
        /* 卡片視圖 */
        <div className="space-y-4">
        {items.length > 0 ? (
          items.map((item, idx) => {
            const unitPrice = getItemUnitPrice(item);
            const itemParticipants = participants.filter(p => p.item_id === item.id);
            const totalBoughtQty = itemParticipants.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
            const stock = Number(item.stock) || 1;
            const isSoldOut = totalBoughtQty >= stock;

            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-none p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black space-y-3 relative transition-all"
              >
                {/* 種類 Header */}
                <div className="flex items-start gap-3">
                  {/* 序號與排序按鈕 */}
                  <div className="flex flex-col items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-950/40 p-1 border-2 border-black">
                    <span className="text-[9px] font-black uppercase text-gray-500">順序</span>
                    <input
                      type="number"
                      min="1"
                      max={items.length}
                      value={idx + 1}
                      onChange={(e) => handleSetItemRank(idx, e.target.value)}
                      className="w-9 h-7 text-center font-mono font-black text-xs bg-white dark:bg-gray-800 text-black dark:text-white border border-black focus:outline-none"
                      title="自訂熱度順序 (填寫數字)"
                    />
                    <div className="flex items-center gap-0.5 mt-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveItemUp(idx)}
                        className="p-0.5 text-gray-500 hover:text-black dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                        title="上移"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        disabled={idx === items.length - 1}
                        onClick={() => handleMoveItemDown(idx)}
                        className="p-0.5 text-gray-500 hover:text-black dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                        title="下移"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                  </div>

                  {/* 種類圖片 */}
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-16 h-16 object-cover rounded-none border-2 border-black shrink-0" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-400 shrink-0">
                      <ImageIcon size={20} />
                      <span className="text-[9px] mt-0.5">圖片</span>
                    </div>
                  )}

                  {/* 種類資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-base text-gray-900 dark:text-gray-100 truncate">
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsAddItemOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-primary rounded-none hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="編輯種類品項"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-none hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="刪除種類"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
                      <div>
                        <span className="font-bold text-gray-500">單件單價：</span>
                        <span className="font-extrabold text-purple-700 dark:text-purple-300">NT$ {unitPrice}</span>
                        {stock > 1 && (
                          <span className="text-[11px] font-bold text-gray-500 ml-1.5">(種類小計 $NT$ {unitPrice * stock})</span>
                        )}
                        {split.use_multiplier && (
                          <span className="text-[10px] text-gray-400 ml-1.5">(倍率: {item.price_multiplier || 1.0}x)</span>
                        )}
                        {item.manual_price !== undefined && item.manual_price !== null && item.manual_price !== '' && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded ml-1 font-bold">自填單價</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span><strong className="text-gray-500">庫存/總數量：</strong>{stock}</span>
                        <span><strong className="text-gray-500">已認領：</strong>{totalBoughtQty} / {stock}</span>
                        {isSoldOut && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 rounded">完售</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 參團人員清單區塊 (手繪稿 3 右側參團人卡片) */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">參團人員喊單區：</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveItemIdForParticipant(item.id);
                        setIsAddParticipantOpen(true);
                      }}
                      className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-150 dark:border-purple-900 rounded-none transition-all active:scale-95"
                    >
                      <UserPlus size={13} />
                      <span>+ 登記參團人員</span>
                    </button>
                  </div>

                  {itemParticipants.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {itemParticipants.map((p) => {
                        const singleUnitPrice = unitPrice;
                        const allocatedQty = allocatedMap.get(p.id) ?? p.qty;
                        const partCost = Math.round(singleUnitPrice * allocatedQty);

                        return (
                          <div
                            key={p.id}
                            className={`rounded-none p-2.5 flex items-center gap-2 shadow-2xs relative group min-w-[130px] border transition-all ${
                              allocatedQty === 0 
                                ? 'bg-gray-100/70 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-700 opacity-60' 
                                : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                                  {p.buyer_name}
                                </span>
                                {p.is_allin && (
                                  <span className="text-[9px] font-black bg-amber-400 text-black px-1 rounded">
                                    ALL IN
                                  </span>
                                )}
                                {passTriggeredSet.has(p.id) ? (
                                  <span className="text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-1 rounded" title="因未中選指定品項觸發 Pass 條件">
                                    [PASS] 無 A 則 Pass
                                  </span>
                                ) : p.pass_rule && p.pass_rule !== 'none' ? (
                                  <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 px-1 rounded" title="此喊單帶有 Pass 條件">
                                    帶 Pass 條件
                                  </span>
                                ) : null}
                                {allocatedQty === 0 && !passTriggeredSet.has(p.id) ? (
                                  <span className="text-[9px] font-bold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-1 rounded">
                                    候補
                                  </span>
                                ) : allocatedQty < p.qty && allocatedQty > 0 ? (
                                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                                    配到 x{allocatedQty}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                <strong>x{p.qty}</strong>
                                <span>• {allocatedQty > 0 ? `$${partCost}` : '$0 (未配到)'}</span>
                              </div>
                              {p.timestamp && (
                                <div className="text-[9px] text-gray-400">
                                  {p.timestamp}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingParticipant(p);
                                  setActiveItemIdForParticipant(p.item_id);
                                  setIsAddParticipantOpen(true);
                                }}
                                className="p-1 text-gray-400 hover:text-primary rounded-none hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                                title="編輯參團者"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParticipant(p.id)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded-none hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                                title="刪除參團者"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">尚無參團人員登記 (可點擊右上角新增參團人)</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-none border border-gray-150 dark:border-gray-750 text-gray-400 space-y-2 flex flex-col items-center">
            <Package size={36} className="text-gray-400" />
            <p className="text-xs font-medium">目前尚無品項種類。</p>
            <p className="text-[10px]">點擊右上角「+ 新增種類」按鈕新增角色或品項！</p>
          </div>
        )}
      </div>
      )}

      {/* 彈窗 1：新增/編輯品項種類 Modal */}
      {isAddItemOpen && (
        <AddItemModal
          splitId={splitId}
          existingItem={editingItem}
          onClose={() => {
            setIsAddItemOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* 彈窗 2：新增/編輯參團人員 Modal */}
      {isAddParticipantOpen && activeItemIdForParticipant && (
        <AddParticipantModal
          splitId={splitId}
          itemId={activeItemIdForParticipant}
          existingParticipant={editingParticipant}
          items={items}
          onClose={() => {
            setIsAddParticipantOpen(false);
            setActiveItemIdForParticipant(null);
            setEditingParticipant(null);
          }}
        />
      )}

      {/* 彈窗 3：買家對帳與文案生成 Modal */}
      {isReconciliationOpen && (
        <ReconciliationModal
          split={split}
          items={items}
          participants={participants}
          allocatedMap={allocatedMap}
          getItemUnitPrice={getItemUnitPrice}
          unitSecondShipping={unitSecondShipping}
          onClose={() => setIsReconciliationOpen(false)}
        />
      )}

      {/* 彈窗 4：編輯拆團設定 Modal */}
      {isEditModalOpen && (
        <AddBoxSplitModal
          existingSplit={split}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* 彈窗 5：自定義熱度排序 Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF7] dark:bg-gray-900 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[#FFE66D] border-b-4 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpDown size={20} className="stroke-[3]" />
                <h3 className="font-black text-base text-black uppercase">自定義品項熱度排序 ({items.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="p-1 bg-white border-2 border-black hover:bg-gray-100 text-black font-black cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle / Tip */}
            <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b-2 border-black text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
              💡 順序第 1 位為【熱門角】，末位為【冷門角】。您可直接修改數字或點擊上下鈕調整熱度排名！
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {items.map((item, idx) => {
                const uPrice = getItemUnitPrice(item);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-black text-gray-400">#</span>
                        <input
                          type="number"
                          min="1"
                          max={items.length}
                          value={idx + 1}
                          onChange={(e) => handleSetItemRank(idx, e.target.value)}
                          className="w-10 h-8 text-center font-mono font-black text-sm bg-amber-100 dark:bg-amber-950/50 text-black dark:text-white border-2 border-black focus:outline-none"
                        />
                      </div>

                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-cover border-2 border-black shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 border-2 border-black shrink-0 flex items-center justify-center text-gray-400">
                          <ImageIcon size={16} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="font-black text-sm text-black dark:text-white truncate block">{item.name}</span>
                        <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">NT$ {uPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveItemUp(idx)}
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 border-2 border-black text-xs font-black hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 cursor-pointer"
                        title="往上移"
                      >
                        ▲ 上移
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() => handleMoveItemDown(idx)}
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 border-2 border-black text-xs font-black hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 cursor-pointer"
                        title="往下移"
                      >
                        ▼ 下移
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-100 dark:bg-gray-800 border-t-4 border-black flex justify-between items-center">
              <button
                type="button"
                onClick={handleAutoSortByLibrary}
                className="px-3 py-1.5 bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-2 border-black font-black text-xs hover:bg-purple-200 cursor-pointer"
              >
                ✨ 依全域角色庫自動排序
              </button>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-5 py-1.5 bg-[#4ECDC4] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs hover:bg-[#3dbdb4] cursor-pointer"
              >
                完成排序
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// 子彈窗 1：新增品項種類 (AddItemModal)
// ----------------------------------------------------------------------
function AddItemModal({ splitId, existingItem, onClose }) {
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);

  const [name, setName] = useState(existingItem?.name || '');
  const [stock, setStock] = useState(existingItem?.stock ? String(existingItem.stock) : '1');
  const [manualPrice, setManualPrice] = useState(
    existingItem?.manual_price !== undefined && existingItem?.manual_price !== null ? String(existingItem.manual_price) : ''
  );
  const [priceMultiplier, setPriceMultiplier] = useState(
    existingItem?.price_multiplier ? String(existingItem.price_multiplier) : '1.0'
  );
  const [image, setImage] = useState(existingItem?.image || '');
  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 800);
      setImage(compressed);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (existingItem) {
        await db.box_split_items.update(existingItem.id, {
          name: name.trim(),
          stock: Number(stock) || 1,
          manual_price: manualPrice !== '' ? Number(manualPrice) : null,
          price_multiplier: Number(priceMultiplier) || 1.0,
          image,
          updated_at: new Date().toISOString()
        });
      } else {
        const existingItems = await db.box_split_items.where('box_split_id').equals(Number(splitId)).toArray();
        const nextSortOrder = existingItems.length > 0 ? Math.max(...existingItems.map(i => i.sort_order || 0)) + 1 : 1;

        await db.box_split_items.add({
          box_split_id: Number(splitId),
          name: name.trim(),
          stock: Number(stock) || 1,
          manual_price: manualPrice !== '' ? Number(manualPrice) : null,
          price_multiplier: Number(priceMultiplier) || 1.0,
          image,
          sort_order: nextSortOrder,
          created_at: new Date().toISOString()
        });
      }

      onClose();
    } catch (err) {
      console.error('儲存品項失敗:', err);
      alert('寫入失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-md rounded-t-3xl md:rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
            {existingItem ? '編輯種類品項' : '新增種類品項'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-none">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">種類名稱 (角色/品項)</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：鍾離、胡桃、徽章A..."
              className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">庫存 / 總數量</label>
              <input
                type="number"
                min="1"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">單價倍率 (預設 1.0)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={priceMultiplier}
                onChange={(e) => setPriceMultiplier(e.target.value)}
                placeholder="1.0"
                className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">自訂單價 (選填，填寫將覆蓋平均與倍率)</label>
            <input
              type="number"
              min="0"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="留空則自動計算平均或倍率單價"
              className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
            />
          </div>

          {/* 圖片上傳 */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">種類圖片 (選填)</label>
            <div className="flex items-center gap-3">
              {image ? (
                <div className="w-16 h-16 rounded-none border border-gray-200 overflow-hidden relative group shrink-0">
                  <img src={image} alt="預覽" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImage('')} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0 border border-dashed border-gray-300">
                  <ImageIcon size={20} />
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="py-1.5 bg-gray-100 dark:bg-gray-800 rounded-none text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1">
                    <Camera size={13} /> 拍照
                  </button>
                  <button type="button" onClick={() => albumInputRef.current?.click()} className="py-1.5 bg-gray-100 dark:bg-gray-800 rounded-none text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1">
                    <ImageIcon size={13} /> 相簿
                  </button>
                </div>
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageChange} className="hidden" />
                <input type="file" accept="image/*" ref={albumInputRef} onChange={handleImageChange} className="hidden" />

                <div className="flex gap-1">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="貼上圖片網址..."
                    className="flex-1 bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-2.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInput.trim()) {
                        setImage(urlInput.trim());
                        setUrlInput('');
                      }
                    }}
                    className="px-2.5 py-1 bg-gray-200 dark:bg-gray-700 rounded-none text-xs font-bold"
                  >
                    套用
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 flex gap-2 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none font-bold text-xs">
            取消
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !name.trim()} className="flex-1 py-2.5 bg-primary text-white rounded-none font-bold text-xs">
            儲存種類
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 子彈窗 2：新增參團人員 (AddParticipantModal)
// ----------------------------------------------------------------------
function AddParticipantModal({ splitId, itemId, existingParticipant, items, onClose }) {
  const currentItem = items.find(i => i.id === itemId);

  const [buyerName, setBuyerName] = useState(existingParticipant?.buyer_name || '');
  const [qty, setQty] = useState(existingParticipant?.qty ? String(existingParticipant.qty) : '1');
  const [isAllin, setIsAllin] = useState(Boolean(existingParticipant?.is_allin));
  const [timestamp, setTimestamp] = useState(() => {
    if (existingParticipant?.timestamp) return existingParticipant.timestamp;
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getMonth() + 1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  // 「無 A 則 Pass」條件狀態
  const [enablePassRule, setEnablePassRule] = useState(
    Boolean(existingParticipant?.pass_rule && existingParticipant.pass_rule !== 'none')
  );
  const [passRuleType, setPassRuleType] = useState(
    existingParticipant?.pass_rule === 'pass_all' ? 'pass_all' : 'pass_item'
  );
  const [passTriggerItemId, setPassTriggerItemId] = useState(
    existingParticipant?.pass_trigger_item_id ? String(existingParticipant.pass_trigger_item_id) : ''
  );
  const [passTargetItemId, setPassTargetItemId] = useState(
    existingParticipant?.pass_target_item_id ? String(existingParticipant.pass_target_item_id) : String(itemId)
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleToggleAllin = (checked) => {
    setIsAllin(checked);
    if (checked && currentItem) {
      setQty(String(currentItem.stock || 1));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!buyerName.trim()) return;

    const passData = {
      pass_rule: enablePassRule ? passRuleType : 'none',
      pass_trigger_item_id: enablePassRule && passTriggerItemId ? Number(passTriggerItemId) : null,
      pass_target_item_id: enablePassRule && passRuleType === 'pass_item' && passTargetItemId ? Number(passTargetItemId) : null
    };

    setIsSaving(true);
    try {
      if (existingParticipant) {
        await db.box_split_participants.update(existingParticipant.id, {
          buyer_name: buyerName.trim(),
          qty: Number(qty) || 1,
          is_allin: Boolean(isAllin),
          timestamp: timestamp.trim(),
          ...passData,
          updated_at: new Date().toISOString()
        });
      } else {
        await db.box_split_participants.add({
          box_split_id: Number(splitId),
          item_id: Number(itemId),
          buyer_name: buyerName.trim(),
          qty: Number(qty) || 1,
          is_allin: Boolean(isAllin),
          timestamp: timestamp.trim(),
          ...passData,
          created_at: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      console.error('儲存參團人員失敗:', err);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl md:rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300 md:max-w-md">
        
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
              {existingParticipant ? '編輯參團人員' : '登記參團人員'}
            </h3>
            <span className="text-[10px] text-purple-600 font-bold block">品項：{currentItem?.name || '未知種類'}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-none">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">參團人員 ID / 姓名</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="例如：小明, @user123..."
              className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">購買數量</label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllin}
                  onChange={(e) => handleToggleAllin(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span className="text-xs font-black text-amber-900 dark:text-amber-200">一鍵 ALL IN (包款)</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">喊單發訊時間 (用於先喊先贏排序)</label>
            <input
              type="text"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="如：8/28 14:00"
              className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-black rounded-none px-3.5 py-2 text-xs text-gray-800 dark:text-gray-100"
            />
          </div>

          {/* 無 A 則 Pass 條件設定區塊 */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <label className="flex items-center justify-between cursor-pointer p-2.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-none">
              <span className="text-xs font-black text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                啟用「無 A 則 Pass」條件 (A Pass B)
              </span>
              <input
                type="checkbox"
                checked={enablePassRule}
                onChange={(e) => setEnablePassRule(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </label>

            {enablePassRule && (
              <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-none border border-purple-150 dark:border-purple-900/40 space-y-3 text-xs animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block">
                    條件觸發：若未配到 / 未中選品項 (A)
                  </label>
                  <select
                    value={passTriggerItemId}
                    onChange={(e) => setPassTriggerItemId(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-none px-3 py-2 font-bold text-xs text-gray-800 dark:text-gray-100"
                  >
                    <option value="">-- 請選擇觸發目標品項 A --</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block">
                    處理方式 (Pass 動作)
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="passRuleType"
                        value="pass_item"
                        checked={passRuleType === 'pass_item'}
                        onChange={() => setPassRuleType('pass_item')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">忽略特定品項 (B) 的喊單</span>
                      </div>
                    </label>

                    {passRuleType === 'pass_item' && (
                      <div className="pl-6 space-y-1">
                        <select
                          value={passTargetItemId}
                          onChange={(e) => setPassTargetItemId(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-none px-3 py-2 font-bold text-xs text-gray-800 dark:text-gray-100"
                        >
                          <option value="">-- 請選擇被 Pass 的品項 B --</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="passRuleType"
                        value="pass_all"
                        checked={passRuleType === 'pass_all'}
                        onChange={() => setPassRuleType('pass_all')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">忽略該買家在全團所有品項的喊單 (全 Pass)</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none font-bold text-xs">
              取消
            </button>
            <button type="submit" disabled={isSaving || !buyerName.trim()} className="flex-1 py-2.5 bg-primary text-white rounded-none font-bold text-xs">
              確認登記
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 子彈窗 3：買家對帳與文案生成 Modal (ReconciliationModal)
// ----------------------------------------------------------------------
function ReconciliationModal({ split, items, participants, allocatedMap, getItemUnitPrice, unitSecondShipping, onClose }) {
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // 模式標籤對照表
  const MODE_LABELS = {
    time_first: '先喊先贏 (按時間排序)',
    amount_first: '金額多帶優先',
    qty_first: '數量帶多優先',
    allin_time_first: 'ALL IN 外加先喊先贏'
  };

  // 整理全團所有獨一無二的參團人員買家 ID
  const allBuyerNames = Array.from(new Set(participants.map(p => p.buyer_name))).filter(Boolean);

  // 計算特定買家的全團購得細節
  const getBuyerSummary = (bName) => {
    if (!bName) return null;

    const buyerParts = participants.filter(p => p.buyer_name === bName);
    const itemSummaries = [];
    let totalItemsCost = 0;
    let totalQuantity = 0;

    buyerParts.forEach(p => {
      const item = items.find(i => i.id === p.item_id);
      if (item) {
        const singleUnitPrice = getItemUnitPrice(item);
        const allocatedQty = allocatedMap?.get(p.id) ?? 0;
        const subTotal = Math.round(singleUnitPrice * allocatedQty);

        if (allocatedQty > 0) {
          totalItemsCost += subTotal;
          totalQuantity += allocatedQty;
        }

        itemSummaries.push({
          itemName: item.name,
          claimedQty: p.qty,
          allocatedQty,
          unitPrice: Math.round(singleUnitPrice),
          subTotal,
          isAllocated: allocatedQty > 0
        });
      }
    });

    const buyerSecondShipping = unitSecondShipping * itemSummaries.filter(i => i.isAllocated).length; // 按配到成功的種類數平攤
    const finalTotal = totalItemsCost + buyerSecondShipping;

    return {
      buyerName: bName,
      itemSummaries,
      totalQuantity,
      totalItemsCost,
      buyerSecondShipping,
      finalTotal
    };
  };

  const activeSummary = selectedBuyer ? getBuyerSummary(selectedBuyer) : null;

  // 產生一鍵複製文案
  const generateCopyText = (sum) => {
    if (!sum) return '';
    let text = `【拆團對帳單 - ${sum.buyerName}】\n`;
    text += `團名：${split.title}\n`;
    text += `優先模式：${MODE_LABELS[split.mode] || '先喊先贏'}\n`;
    text += `------------------------\n`;
    text += `中選配分品項：\n`;
    const allocatedItems = sum.itemSummaries.filter(i => i.isAllocated);
    if (allocatedItems.length > 0) {
      allocatedItems.forEach(i => {
        text += `• ${i.itemName} x ${i.allocatedQty} ($${i.subTotal})\n`;
      });
    } else {
      text += `（無中選品項 / 候補中）\n`;
    }

    const unallocatedItems = sum.itemSummaries.filter(i => !i.isAllocated);
    if (unallocatedItems.length > 0) {
      text += `未中選(候補)：\n`;
      unallocatedItems.forEach(i => {
        text += `• ${i.itemName} x ${i.claimedQty} ($0)\n`;
      });
    }

    text += `------------------------\n`;
    text += `品項費用小計：NT$ ${sum.totalItemsCost}\n`;
    if (unitSecondShipping > 0 && sum.buyerSecondShipping > 0) {
      text += `二補運費小計：NT$ ${sum.buyerSecondShipping}\n`;
    }
    text += `應付總金額：NT$ ${sum.finalTotal}\n`;
    text += `------------------------\n`;
    text += `請核對明細，感謝參團！`;
    return text;
  };

  const handleCopy = (sum) => {
    const text = generateCopyText(sum);
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg rounded-t-3xl md:rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={20} />
            <h3 className="font-bold text-base">買家對帳與文案生成管家</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-white/80 hover:text-white rounded-none">
            <X size={20} />
          </button>
        </div>

        {/* 內容區 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* 選擇買家 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">請選擇要對帳的參團人員：</label>
            {allBuyerNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allBuyerNames.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBuyer(b)}
                    className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all border ${
                      selectedBuyer === b
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">目前尚未有任何參團人員登記。</p>
            )}
          </div>

          {/* 買家帳單詳情 */}
          {activeSummary && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-none p-4 border-2 border-black space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span className="font-black text-sm text-gray-900 dark:text-gray-100">
                  對帳對象：{activeSummary.buyerName}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSummary)}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95"
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopied ? '已複製文案！' : '一鍵複製對帳文案'}</span>
                </button>
              </div>

              {/* 品項明細 */}
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-gray-500 block">喊單與配分品項清單：</span>
                {activeSummary.itemSummaries.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex justify-between items-center p-2 rounded-none border ${
                      item.isAllocated 
                        ? 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-750' 
                        : 'bg-gray-100/60 dark:bg-gray-800/40 border-dashed border-gray-300 dark:border-gray-700 opacity-60'
                    }`}
                  >
                    <div>
                      <span>{item.itemName} x <strong>{item.allocatedQty}</strong></span>
                      {item.claimedQty > item.allocatedQty && (
                        <span className="text-[10px] text-gray-400 ml-1.5">(原喊 x{item.claimedQty})</span>
                      )}
                    </div>
                    <span className={`font-bold ${item.isAllocated ? 'text-purple-700 dark:text-purple-300' : 'text-gray-400'}`}>
                      {item.isAllocated ? `NT$ ${item.subTotal}` : '未配到 ($0)'}
                    </span>
                  </div>
                ))}
              </div>

              {/* 費用總計小報 */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>品項費用小計：</span>
                  <span className="font-bold">NT$ {activeSummary.totalItemsCost}</span>
                </div>
                {unitSecondShipping > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>二補運費小計：</span>
                    <span className="font-bold">NT$ {activeSummary.buyerSecondShipping}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-emerald-650 dark:text-emerald-400 pt-1 border-t border-dashed border-gray-300 dark:border-gray-700">
                  <span>應付總金額：</span>
                  <span className="text-base">NT$ {activeSummary.finalTotal}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 shrink-0">
          <button type="button" onClick={onClose} className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-none font-bold text-xs">
            關閉對帳管家
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 子組件：拆團 Sheet 表格試算表視圖 (BoxSplitSheetView)
// ----------------------------------------------------------------------
function BoxSplitSheetView({ 
  split, 
  items = [], 
  participants = [], 
  allocatedMap = new Map(), 
  passTriggeredSet = new Set(), 
  getItemUnitPrice = () => 0, 
  unitSecondShipping = 0, 
  onEditItem, 
  onDeleteItem, 
  onMoveItemUp,
  onMoveItemDown,
  onSetItemRank,
  onAddParticipant, 
  onEditParticipant, 
  onDeleteParticipant, 
  onCopyReconciliation 
}) {
  const [sheetTab, setSheetTab] = useState('items'); // 'items' | 'buyers'

  const safeItems = Array.isArray(items) ? items : [];
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const safeAllocatedMap = (allocatedMap && typeof allocatedMap.get === 'function') ? allocatedMap : new Map();
  const safePassTriggeredSet = (passTriggeredSet && typeof passTriggeredSet.has === 'function') ? passTriggeredSet : new Set();
  const safeGetUnitPrice = typeof getItemUnitPrice === 'function' ? getItemUnitPrice : () => 0;
  const safeUnitSecondShipping = Number(unitSecondShipping) || 0;

  const allBuyerNames = Array.from(new Set(safeParticipants.map(p => p?.buyer_name))).filter(Boolean);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Sub-Tab 選擇：表一 vs 表二 */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetTab('items')}
            className={`px-3.5 py-1.5 rounded-none text-xs font-bold transition-all flex items-center gap-1.5 ${
              sheetTab === 'items'
                ? 'bg-purple-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span>表一：品項與喊單配分總表 ({safeItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSheetTab('buyers')}
            className={`px-3.5 py-1.5 rounded-none text-xs font-bold transition-all flex items-center gap-1.5 ${
              sheetTab === 'buyers'
                ? 'bg-purple-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span>表二：參團買家對帳總表 ({allBuyerNames.length})</span>
          </button>
        </div>
      </div>

      {sheetTab === 'items' ? (
        /* 表一：品項與喊單配分總表 */
        <div className="bg-white dark:bg-gray-800 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 font-black whitespace-nowrap">
                <th className="p-3 w-14 text-center">熱度順序</th>
                <th className="p-3 w-14 text-center">圖片</th>
                <th className="p-3 min-w-[120px]">品項種類</th>
                <th className="p-3 text-center w-16">庫存</th>
                <th className="p-3 text-right w-24">單件金額</th>
                <th className="p-3 text-center w-28">認領進度</th>
                <th className="p-3 min-w-[280px]">參團人員與配分名單 (Sheet View)</th>
                <th className="p-3 text-center w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
              {safeItems.length > 0 ? (
                safeItems.map((item, idx) => {
                  if (!item) return null;
                  const singleUnitPrice = safeGetUnitPrice(item);
                  const stock = Number(item.stock) || 1;
                  const itemParts = safeParticipants.filter(p => p && p.item_id === item.id);
                  const totalBoughtQty = itemParts.reduce((sum, p) => sum + (Number(p?.qty) || 0), 0);
                  const isSoldOut = totalBoughtQty >= stock;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-3 text-center font-bold text-gray-500">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max={safeItems.length}
                            value={idx + 1}
                            onChange={(e) => onSetItemRank && onSetItemRank(idx, e.target.value)}
                            className="w-7 h-6 text-center font-mono font-black text-xs bg-amber-50 dark:bg-amber-950/40 text-black dark:text-white border border-black focus:outline-none"
                            title="填寫數字自訂熱度順序"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button
                              disabled={idx === 0}
                              onClick={() => onMoveItemUp && onMoveItemUp(idx)}
                              className="p-0.5 text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                              title="順序上移"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              disabled={idx === safeItems.length - 1}
                              onClick={() => onMoveItemDown && onMoveItemDown(idx)}
                              className="p-0.5 text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                              title="順序下移"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-9 h-9 object-cover rounded-none border border-gray-200 inline-block" />
                        ) : (
                          <div className="w-9 h-9 rounded-none bg-gray-100 dark:bg-gray-700 inline-flex items-center justify-center text-gray-400">
                            <ImageIcon size={14} />
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-extrabold text-gray-900 dark:text-gray-100">
                        {item.name}
                        {item.price_multiplier && Number(item.price_multiplier) !== 1.0 && (
                          <span className="text-[10px] text-gray-400 block font-normal">(倍率: {item.price_multiplier}x)</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold">{stock}</td>
                      <td className="p-3 text-right font-extrabold text-purple-700 dark:text-purple-300">
                        NT$ {singleUnitPrice}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold ${
                          isSoldOut ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}>
                          {totalBoughtQty} / {stock} {isSoldOut ? '(完售)' : ''}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {itemParts.map(p => {
                            if (!p) return null;
                            const allocatedQty = safeAllocatedMap.get(p.id) ?? (p.qty || 0);
                            const isPass = safePassTriggeredSet.has(p.id);

                            return (
                              <span 
                                key={p.id} 
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none border text-[11px] font-bold ${
                                  isPass
                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 line-through opacity-70'
                                    : allocatedQty === 0
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-dashed border-gray-300 opacity-60'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200'
                                }`}
                              >
                                <span>{p.buyer_name}</span>
                                <strong className="text-purple-600 dark:text-purple-400">x{p.qty}</strong>
                                {isPass ? (
                                  <span className="text-[9px] text-purple-700 font-black">(無A則Pass)</span>
                                ) : allocatedQty === 0 ? (
                                  <span className="text-[9px] text-red-600 font-bold">(候補)</span>
                                ) : allocatedQty < p.qty ? (
                                  <span className="text-[9px] text-amber-600 font-bold">(配到x{allocatedQty})</span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => onEditParticipant && onEditParticipant(p, item.id)}
                                  className="p-0.5 hover:text-primary rounded text-gray-400 ml-0.5"
                                  title="編輯喊單"
                                >
                                  <Pencil size={10} />
                                </button>
                              </span>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => onAddParticipant && onAddParticipant(item.id)}
                            className="px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-none border border-dashed border-purple-300 transition-all"
                          >
                            + 喊單
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditItem && onEditItem(item)}
                            className="p-1 text-gray-400 hover:text-primary rounded-none hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="編輯品項"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem && onDeleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded-none hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="刪除品項"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-gray-400">
                    尚無品項種類資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* 表二：參團買家對帳總表 Sheet */
        <div className="bg-white dark:bg-gray-800 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-700 text-white border-b border-emerald-800 font-black whitespace-nowrap">
                <th className="p-3 min-w-[120px]">買家 ID / 姓名</th>
                <th className="p-3 min-w-[240px]">中選配分品項明細</th>
                <th className="p-3 text-center w-24">中選總件數</th>
                <th className="p-3 text-right w-24">品項小計</th>
                <th className="p-3 text-right w-24">二補運費</th>
                <th className="p-3 text-right w-28">應付總金額</th>
                <th className="p-3 text-center w-28">對帳文案</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
              {allBuyerNames.length > 0 ? (
                allBuyerNames.map((bName) => {
                  if (!bName) return null;
                  const buyerParts = safeParticipants.filter(p => p && p.buyer_name === bName);
                  const itemSummaries = [];
                  let totalItemsCost = 0;
                  let totalQuantity = 0;

                  buyerParts.forEach(p => {
                    if (!p) return;
                    const item = safeItems.find(i => i && i.id === p.item_id);
                    if (item) {
                      const singleUnitPrice = safeGetUnitPrice(item);
                      const allocatedQty = safeAllocatedMap.get(p.id) ?? 0;
                      const subTotal = Math.round(singleUnitPrice * allocatedQty);

                      if (allocatedQty > 0) {
                        totalItemsCost += subTotal;
                        totalQuantity += allocatedQty;
                      }

                      itemSummaries.push({
                        itemName: item.name || '未命名品項',
                        allocatedQty,
                        claimedQty: p.qty || 0,
                        subTotal,
                        isAllocated: allocatedQty > 0
                      });
                    }
                  });

                  const allocatedKindsCount = itemSummaries.filter(i => i.isAllocated).length;
                  const buyerSecondShipping = safeUnitSecondShipping * allocatedKindsCount;
                  const finalTotal = totalItemsCost + buyerSecondShipping;

                  return (
                    <tr key={bName} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-3 font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <span>{bName}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {itemSummaries.map((s, i) => (
                            <span 
                              key={i} 
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.isAllocated 
                                  ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200' 
                                  : 'bg-gray-100 text-gray-400 border border-dashed border-gray-300 line-through'
                              }`}
                            >
                              {s.itemName} x{s.allocatedQty} {s.isAllocated ? `($${s.subTotal})` : '(未配到)'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-purple-700 dark:text-purple-300">
                        {totalQuantity} 件
                      </td>
                      <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-300">
                        NT$ {totalItemsCost}
                      </td>
                      <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-300">
                        NT$ {buyerSecondShipping}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        NT$ {finalTotal}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => onCopyReconciliation && onCopyReconciliation(bName)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none text-[11px] font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1 mx-auto"
                        >
                          <Copy size={11} />
                          <span>複製文案</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">
                    尚無買家參團紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
