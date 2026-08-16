import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, CheckSquare, Square, Package, Check, ArrowRight } from 'lucide-react';
import { db } from '../db';
import { calculateOrderTotalTWD, getItemIps } from '../utils';

export default function ImportUnassignedModal({ orderId, onClose, onSuccess }) {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  // 撈取無歸屬的物品 (order_id 為 null / undefined / 0)
  const unassignedItems = useLiveQuery(async () => {
    const allItems = await db.items.toArray();
    return allItems.filter(item => !item.order_id);
  }, []) || [];

  const toggleSelect = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === unassignedItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(unassignedItems.map(i => i.id));
    }
  };

  const handleImportSelected = async () => {
    if (selectedItemIds.length === 0 || !orderId) return;
    setIsImporting(true);

    try {
      // 1. 批次更新選取物品的 order_id 為當前 orderId
      await db.transaction('rw', db.items, db.orders, async () => {
        for (const itemId of selectedItemIds) {
          await db.items.update(itemId, { order_id: orderId });
        }

        // 2. 重新撈取該訂單下所有物品並計算新總額
        const allItems = await db.items.where({ order_id: orderId }).toArray();
        const newTotal = allItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);

        const parentOrder = await db.orders.get(orderId);
        if (parentOrder) {
          const updatedOrder = {
            ...parentOrder,
            total_amount: newTotal
          };
          const newTotalTWD = calculateOrderTotalTWD(updatedOrder, allItems);

          await db.orders.update(orderId, {
            total_amount: newTotal,
            total_amount_twd: newTotalTWD
          });
        }
      });

      alert(`✅ 已成功將 ${selectedItemIds.length} 筆獨立物品併入此訂單！`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('併入物品失敗:', error);
      alert('❌ 併入物品失敗，請稍後重試');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
    >
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        
        {/* 頁首 */}
        <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-secondary-light/50 dark:bg-secondary-dark/30 text-secondary-dark dark:text-secondary-light flex items-center justify-center font-bold">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">從待歸屬物品併入本訂單</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                可勾選單一或多筆獨立登記的物品直接併入
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 全選工具列 */}
        {unassignedItems.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
            >
              {selectedItemIds.length === unassignedItems.length ? (
                <CheckSquare size={16} className="text-primary" />
              ) : (
                <Square size={16} className="text-gray-400" />
              )}
              <span>全選 ({selectedItemIds.length} / {unassignedItems.length})</span>
            </button>
          </div>
        )}

        {/* 待歸屬物品列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
          {unassignedItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Package className="text-gray-300 dark:text-gray-600 mb-2" size={36} />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">目前尚無任何獨立待歸屬物品</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">您可以在單獨新增物品後再回來進行併入</p>
            </div>
          ) : (
            unassignedItems.map(item => {
              const isSelected = selectedItemIds.includes(item.id);
              const isUrl = (str) => typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
              const coverImg = item.images?.[0] || item.image;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected 
                      ? 'border-primary bg-primary-light/10 dark:bg-primary-dark/20 dark:border-primary' 
                      : 'border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 text-primary">
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                    </div>

                    {coverImg ? (
                      <img 
                        src={coverImg} 
                        alt={item.name} 
                        className="w-11 h-11 object-cover rounded-xl border border-gray-200 dark:border-gray-700 shrink-0" 
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 shrink-0">
                        <Package size={18} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-2">
                        {getItemIps(item).length > 0 && <span>IP: {getItemIps(item).join(', ')}</span>}
                        <span>數量: x{item.quantity}</span>
                        <span className="font-semibold text-primary-dark dark:text-primary">
                          ${Number(item.price || 0) * Number(item.quantity || 1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all"
          >
            取消
          </button>
          <button
            type="button"
            disabled={selectedItemIds.length === 0 || isImporting}
            onClick={handleImportSelected}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Check size={16} />
            <span>併入本訂單 ({selectedItemIds.length})</span>
          </button>
        </div>

      </div>
    </div>
  );
}
