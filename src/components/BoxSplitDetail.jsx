import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Pencil, Sparkles, 
  Copy, Check, UserPlus, DollarSign, Calculator, Image as ImageIcon, Camera, X 
} from 'lucide-react';
import { db } from '../db';
import AddBoxSplitModal, { BOX_SPLIT_MODES } from './AddBoxSplitModal';
import { compressImage } from '../utils';
import { useHardwareBack } from '../hooks/useHardwareBack';

// ----------------------------------------------------------------------
// 配分引擎：根據模式 (time_first, amount_first, qty_first, allin_time_first) 與品項庫存 (stock) 配分
// ----------------------------------------------------------------------
export function computeSplitAllocations(split, items = [], participants = [], getItemUnitPrice) {
  const mode = split?.mode || 'time_first';
  const allocatedMap = new Map();

  const safeItems = Array.isArray(items) ? items : [];
  const safeParticipants = Array.isArray(participants) ? participants : [];

  // 1. 預先計算買家在全團的總消費金額與總喊單數量 (用於 amount_first / qty_first 模式的優先權排序)
  const buyerTotalSpend = new Map();
  const buyerTotalQty = new Map();

  safeParticipants.forEach(p => {
    if (!p) return;
    const item = safeItems.find(i => i && i.id === p.item_id);
    if (item && typeof getItemUnitPrice === 'function') {
      const uPrice = getItemUnitPrice(item);
      const stock = Number(item.stock) || 1;
      const singleUnitPrice = stock > 0 ? (uPrice / stock) : uPrice;
      const spend = Math.round(singleUnitPrice * (p.qty || 1));

      buyerTotalSpend.set(p.buyer_name, (buyerTotalSpend.get(p.buyer_name) || 0) + spend);
      buyerTotalQty.set(p.buyer_name, (buyerTotalQty.get(p.buyer_name) || 0) + (p.qty || 1));
    }
  });

  // 2. 針對每個品項，依模式優先順序排序喊單，並依據庫存 (stock) 進行配分
  safeItems.forEach(item => {
    if (!item) return;
    const stock = Number(item.stock) || 1;
    let remainingStock = stock;

    let itemParts = safeParticipants.filter(p => p && p.item_id === item.id);

    // 依據模式排序 itemParts
    itemParts.sort((a, b) => {
      if (mode === 'allin_time_first') {
        // ALL IN 優先 over 非 ALL IN
        if (a.is_allin && !b.is_allin) return -1;
        if (!a.is_allin && b.is_allin) return 1;
        return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (a.id - b.id);
      } else if (mode === 'amount_first') {
        // 總消費金額高者優先
        const spendA = buyerTotalSpend.get(a.buyer_name) || 0;
        const spendB = buyerTotalSpend.get(b.buyer_name) || 0;
        if (spendB !== spendA) return spendB - spendA;
        return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (a.id - b.id);
      } else if (mode === 'qty_first') {
        // 總購買數量多者優先
        const qtyA = buyerTotalQty.get(a.buyer_name) || 0;
        const qtyB = buyerTotalQty.get(b.buyer_name) || 0;
        if (qtyB !== qtyA) return qtyB - qtyA;
        return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (a.id - b.id);
      } else {
        // 'time_first' 先喊先贏: 依時間排序
        return (a.timestamp || a.created_at || '').localeCompare(b.timestamp || b.created_at || '') || (a.id - b.id);
      }
    });

    // 配分扣減庫存
    itemParts.forEach(p => {
      if (remainingStock > 0) {
        const take = Math.min(remainingStock, Number(p.qty) || 1);
        allocatedMap.set(p.id, take);
        remainingStock -= take;
      } else {
        allocatedMap.set(p.id, 0); // 庫存用盡，未能配到
      }
    });
  });

  return allocatedMap;
}

export default function BoxSplitDetail({ splitId, onBack }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [activeItemIdForParticipant, setActiveItemIdForParticipant] = useState(null);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [copiedBuyer, setCopiedBuyer] = useState(null);

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

  // 二補總額更新 handler
  const handleUpdateSecondShipping = async (val) => {
    const fee = Number(val) || 0;
    await db.box_splits.update(Number(splitId), { second_shipping_fee: fee });
  };

  // 算式計算：單二補金額 (總二補金額 / 種類總數)
  const totalSecondShipping = Number(split?.second_shipping_fee) || 0;
  const itemCount = items.length || 1;
  const unitSecondShipping = totalSecondShipping > 0 ? Math.round(totalSecondShipping / itemCount) : 0;

  // 算式計算：預設平均單價 (拆團總金額 / 種類總數量或種類種類數)
  const totalBoxAmount = Number(split?.total_amount) || 0;
  const totalItemSlots = items.length || 1;
  const averageUnitPrice = totalBoxAmount > 0 ? totalBoxAmount / totalItemSlots : 0;

  // 計算特定品項種類單價
  const getItemUnitPrice = (item) => {
    if (!item) return 0;
    if (item.manual_price !== undefined && item.manual_price !== null && item.manual_price !== '') {
      return Number(item.manual_price) || 0;
    }
    if (split?.use_multiplier) {
      const mult = Number(item.price_multiplier) || 1.0;
      return Math.round(averageUnitPrice * mult);
    }
    return Math.round(averageUnitPrice);
  };

  if (!split) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>載入中或拆團不存在...</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">
          返回列表
        </button>
      </div>
    );
  }

  const currentModeInfo = BOX_SPLIT_MODES.find(m => m.id === split.mode) || BOX_SPLIT_MODES[0];
  const allocatedMap = computeSplitAllocations(split, items, participants, getItemUnitPrice);

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

    alert('✨ 已成功依照角色排序庫重新排列品項順序！');
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

  // 刪除品項
  const handleDeleteItem = async (itemId) => {
    if (window.confirm('確定要刪除此品項種類嗎？該品項下的喊單紀錄也會一併刪除。')) {
      await db.transaction('rw', db.box_split_items, db.box_split_participants, async () => {
        await db.box_split_items.delete(itemId);
        await db.box_split_participants.where('item_id').equals(itemId).delete();
      });
    }
  };

  // 刪除參團人員紀錄
  const handleDeleteParticipant = async (participantId) => {
    await db.box_split_participants.delete(participantId);
  };

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32">
      
      {/* 頂部導覽 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-colors py-1.5 px-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs"
        >
          <ArrowLeft size={16} />
          <span>返回拆團列表</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReconciliationOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <DollarSign size={14} />
            <span>買家對帳管家</span>
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs transition-colors"
            title="編輯拆團設定"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {/* 手繪稿 3 頂部資訊區塊 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-150 dark:border-gray-750 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{split.title}</h1>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {split.status}
              </span>
            </div>

            {/* 標籤 */}
            {split.tags && split.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {split.tags.map((t, idx) => (
                  <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">拆團總金額</span>
            <span className="text-2xl font-black text-primary-dark dark:text-primary-light">
              NT$ {split.total_amount ? Number(split.total_amount).toLocaleString() : '0'}
            </span>
          </div>
        </div>

        {/* 模式與計算說明 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
          <div className="flex items-center gap-2 bg-purple-50/60 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
            <span className="text-base">⚙️</span>
            <div>
              <span className="font-bold text-purple-900 dark:text-purple-300 block">{currentModeInfo.label}</span>
              <span className="text-[10px] text-purple-700 dark:text-purple-400 block">{currentModeInfo.desc}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-150 dark:border-gray-750">
            <span className="font-bold text-gray-600 dark:text-gray-400">倍率計算單價：</span>
            <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
              split.use_multiplier ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {split.use_multiplier ? '✓ 已開啟 (支援倍率調整)' : '✕ 未開啟 (平均單價)'}
            </span>
          </div>
        </div>
      </div>

      {/* 手繪稿 3：總二補金額與單二補金額計算框 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-2 border-gray-900 dark:border-gray-100 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm font-black text-gray-900 dark:text-gray-100 whitespace-nowrap">
              總二補金額：
            </label>
            <input
              type="number"
              min="0"
              value={split.second_shipping_fee || ''}
              onChange={(e) => handleUpdateSecondShipping(e.target.value)}
              placeholder="(自填數字)"
              className="w-36 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-3.5 py-1.5 rounded-xl text-right shrink-0">
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block">
              單二補金額 (總二補金額除以總種類數量)：
            </span>
            <span className="text-base font-black text-purple-900 dark:text-purple-200">
              NT$ {unitSecondShipping.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 品項種類管理頭列與按鈕 */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">品項種類清單 ({items.length})</h2>
          <button
            onClick={handleAutoSortByLibrary}
            className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 hover:bg-purple-200 border border-purple-300 dark:border-purple-800 px-2.5 py-1 rounded-xl transition-all active:scale-95"
            title="點擊依全域角色排序庫自動排列品項"
          >
            <Sparkles size={13} />
            <span>依角色排序庫自動排序</span>
          </button>
        </div>

        <button
          onClick={() => setIsAddItemOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
        >
          <Plus size={16} />
          <span>新增種類</span>
        </button>
      </div>

      {/* 品項種類卡片列表 (手繪稿 3) */}
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
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3 relative transition-all"
              >
                {/* 種類 Header */}
                <div className="flex items-start gap-3">
                  {/* 序號與排序按鈕 */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100 w-7 text-center">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveItemUp(idx)}
                        className="p-1 text-gray-400 hover:text-primary disabled:opacity-20 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="上移"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        disabled={idx === items.length - 1}
                        onClick={() => handleMoveItemDown(idx)}
                        className="p-1 text-gray-400 hover:text-primary disabled:opacity-20 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="下移"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 種類圖片 */}
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-gray-700 shrink-0" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-400 shrink-0">
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
                          className="p-1 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="編輯種類品項"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="刪除種類"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
                      <div>
                        <span className="font-bold text-gray-500">單價：</span>
                        <span className="font-extrabold text-purple-700 dark:text-purple-300">NT$ {unitPrice}</span>
                        {stock > 1 && (
                          <span className="text-[11px] font-bold text-gray-500 ml-1.5">(單件約 ${Math.round(unitPrice / stock)})</span>
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
                      className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-150 dark:border-purple-900 rounded-xl transition-all active:scale-95"
                    >
                      <UserPlus size={13} />
                      <span>+ 登記參團人員</span>
                    </button>
                  </div>

                  {itemParticipants.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {itemParticipants.map((p) => {
                        const singleUnitPrice = stock > 0 ? (unitPrice / stock) : unitPrice;
                        const allocatedQty = allocatedMap.get(p.id) ?? p.qty;
                        const partCost = Math.round(singleUnitPrice * allocatedQty);

                        return (
                          <div
                            key={p.id}
                            className={`rounded-xl p-2.5 flex items-center gap-2 shadow-2xs relative group min-w-[130px] border transition-all ${
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
                                {allocatedQty === 0 ? (
                                  <span className="text-[9px] font-bold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-1 rounded">
                                    候補
                                  </span>
                                ) : allocatedQty < p.qty ? (
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
                                  🕒 {p.timestamp}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteParticipant(p.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
                              title="刪除參團者"
                            >
                              <X size={13} />
                            </button>
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
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-750 text-gray-400 space-y-2">
            <span className="text-3xl block">📦</span>
            <p className="text-xs font-medium">目前尚無品項種類。</p>
            <p className="text-[10px]">點擊右上角「+ 新增種類」按鈕新增角色或品項！</p>
          </div>
        )}
      </div>

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

      {/* 彈窗 2：新增參團人員 Modal */}
      {isAddParticipantOpen && activeItemIdForParticipant && (
        <AddParticipantModal
          splitId={splitId}
          itemId={activeItemIdForParticipant}
          items={items}
          onClose={() => {
            setIsAddParticipantOpen(false);
            setActiveItemIdForParticipant(null);
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
      <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
            {existingItem ? '編輯種類品項' : '新增種類品項'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
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
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
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
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
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
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
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
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100"
            />
          </div>

          {/* 圖片上傳 */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">種類圖片 (選填)</label>
            <div className="flex items-center gap-3">
              {image ? (
                <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden relative group shrink-0">
                  <img src={image} alt="預覽" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImage('')} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0 border border-dashed border-gray-300">
                  <ImageIcon size={20} />
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1">
                    <Camera size={13} /> 拍照
                  </button>
                  <button type="button" onClick={() => albumInputRef.current?.click()} className="py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1">
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
                    className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInput.trim()) {
                        setImage(urlInput.trim());
                        setUrlInput('');
                      }
                    }}
                    className="px-2.5 py-1 bg-gray-200 dark:bg-gray-700 rounded-xl text-xs font-bold"
                  >
                    套用
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 flex gap-2 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs">
            取消
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !name.trim()} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-xs">
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
function AddParticipantModal({ splitId, itemId, items, onClose }) {
  const currentItem = items.find(i => i.id === itemId);

  const [buyerName, setBuyerName] = useState('');
  const [qty, setQty] = useState('1');
  const [isAllin, setIsAllin] = useState(false);
  const [timestamp, setTimestamp] = useState(() => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getMonth() + 1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
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

    setIsSaving(true);
    try {
      await db.box_split_participants.add({
        box_split_id: Number(splitId),
        item_id: Number(itemId),
        buyer_name: buyerName.trim(),
        qty: Number(qty) || 1,
        is_allin: Boolean(isAllin),
        timestamp: timestamp.trim(),
        created_at: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error('新增參團人員失敗:', err);
      alert('登記失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 w-full rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300 md:max-w-md">
        
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">登記參團人員</h3>
            <span className="text-[10px] text-purple-600 font-bold block">品項：{currentItem?.name || '未知種類'}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">參團人員 ID / 姓名</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="例如：小明, @user123..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
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
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 font-bold"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl cursor-pointer">
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
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs">
              取消
            </button>
            <button type="submit" disabled={isSaving || !buyerName.trim()} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-xs">
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
        const uPrice = getItemUnitPrice(item);
        const stock = Number(item.stock) || 1;
        const singleUnitPrice = stock > 0 ? (uPrice / stock) : uPrice;
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
      <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={20} />
            <h3 className="font-bold text-base">買家對帳與文案生成管家</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-white/80 hover:text-white rounded-full">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedBuyer === b
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👤 {b}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">目前尚未有任何參團人員登記。</p>
            )}
          </div>

          {/* 買家帳單詳情 */}
          {activeSummary && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span className="font-black text-sm text-gray-900 dark:text-gray-100">
                  對帳對象：{activeSummary.buyerName}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSummary)}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
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
                    className={`flex justify-between items-center p-2 rounded-xl border ${
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
          <button type="button" onClick={onClose} className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-xs">
            關閉對帳管家
          </button>
        </div>
      </div>
    </div>
  );
}
