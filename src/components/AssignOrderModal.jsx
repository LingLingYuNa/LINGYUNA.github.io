import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Search, Plus, Package, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { db } from '../db';
import { calculateOrderTotalTWD } from '../utils';
import AddOrder from './AddOrder';

export default function AssignOrderModal({ item, items, onClose, onSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const itemsToAssign = React.useMemo(() => {
    if (items && Array.isArray(items) && items.length > 0) return items;
    if (item) return [item];
    return [];
  }, [item, items]);

  const totalSum = itemsToAssign.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);

  // 撈取現有所有訂單
  const orders = useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray()) || [];

  // 篩選訂單
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (order.title && order.title.toLowerCase().includes(q)) ||
      (order.source && order.source.toLowerCase().includes(q)) ||
      (order.status && order.status.toLowerCase().includes(q))
    );
  });

  // 執行歸屬動作
  const handleAssignToOrder = async (targetOrder) => {
    if (itemsToAssign.length === 0 || !targetOrder) return;
    setIsAssigning(true);

    try {
      await db.transaction('rw', db.items, db.orders, async () => {
        // 1. 批量更新物品的 order_id
        for (const targetItem of itemsToAssign) {
          await db.items.update(targetItem.id, {
            order_id: targetOrder.id
          });
        }

        // 2. 重新撈取目標訂單下的所有物品並計算新總金額
        const allItems = await db.items.where({ order_id: targetOrder.id }).toArray();
        const newTotal = allItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);

        const updatedOrder = {
          ...targetOrder,
          total_amount: newTotal
        };
        const newTotalTWD = calculateOrderTotalTWD(updatedOrder, allItems);

        await db.orders.update(targetOrder.id, {
          total_amount: newTotal,
          total_amount_twd: newTotalTWD
        });
      });

      alert(`已成功將 ${itemsToAssign.length} 筆物品併入訂單「${targetOrder.title || targetOrder.source || '未命名訂單'}」！`);
      if (onSuccess) onSuccess(targetOrder.id);
      onClose();
    } catch (error) {
      console.error('歸屬訂單失敗:', error);
      alert('併入訂單失敗，請稍後重試');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
    >
      <div className="bg-white dark:bg-gray-900 rounded-none max-w-lg w-full max-h-[85vh] flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        
        {/* 頁首 */}
        <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-none bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary flex items-center justify-center font-bold">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
                {itemsToAssign.length > 1 ? `將 ${itemsToAssign.length} 筆物品併入訂單` : '將物品併入訂單'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px] sm:max-w-xs">
                {itemsToAssign.length > 1 
                  ? `已選取：${itemsToAssign[0]?.name} 等 ${itemsToAssign.length} 項 (合計 $${totalSum})`
                  : `名稱：${itemsToAssign[0]?.name} ($${totalSum})`
                }
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

        {/* 搜尋與建立按鈕列 */}
        <div className="p-4 space-y-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋訂單名稱、來源或狀態..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOrderOpen(true)}
            className="w-full py-2.5 px-4 bg-primary-light/40 dark:bg-primary-dark/20 hover:bg-primary-light dark:hover:bg-primary-dark/30 text-primary-dark dark:text-primary rounded-none text-xs font-bold flex items-center justify-center gap-2 border border-primary/20 transition-all active:scale-[0.99]"
          >
            <Plus size={15} />
            <span>建立全新訂單並直接併入</span>
          </button>
        </div>

        {/* 訂單選擇清單 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {filteredOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Package className="text-gray-300 dark:text-gray-600 mb-2" size={36} />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {searchQuery ? '找不到符合條件的訂單' : '目前尚無任何訂單'}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                您可以點擊上方按鈕建立新訂單以進行併入
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const orderDateStr = order.created_at ? order.created_at.split('T')[0] : '';
              return (
                <div
                  key={order.id}
                  onClick={() => !isAssigning && handleAssignToOrder(order)}
                  className="group p-3.5 rounded-none border border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 hover:border-primary/50 dark:hover:border-primary/50 hover:bg-primary-light/10 dark:hover:bg-primary-dark/10 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                        {order.title || order.source || '未命名訂單'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-none font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                        {order.status || '已喊單'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                      {orderDateStr && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {orderDateStr}
                        </span>
                      )}
                      <span>幣別：{order.currency || 'TWD'}</span>
                      {order.total_amount_twd > 0 && (
                        <span className="font-bold text-primary-dark dark:text-primary">
                          約 NT${order.total_amount_twd}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAssigning}
                    className="px-3.5 py-2 bg-primary text-white rounded-none text-xs font-bold flex items-center gap-1 group-hover:bg-primary-dark active:scale-95 transition-all shrink-0 shadow-xs disabled:opacity-50"
                  >
                    <span>併入</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 建立新訂單 Modal */}
      {isCreateOrderOpen && (
        <AddOrder 
          onClose={() => setIsCreateOrderOpen(false)} 
          onSuccessCreated={async (newOrderId) => {
            setIsCreateOrderOpen(false);
            const newOrder = await db.orders.get(newOrderId);
            if (newOrder) {
              await handleAssignToOrder(newOrder);
            }
          }}
        />
      )}
    </div>
  );
}
