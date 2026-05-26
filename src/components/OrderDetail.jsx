import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Package, DollarSign, Truck, Percent, Trash2, Pencil } from 'lucide-react';
import { db } from '../db';
import { STATUS_COLORS, CURRENCIES, getStatusStyle, PAYMENT_METHODS } from '../constants';
import AddItem from './AddItem';
import SellItem from './SellItem';
import AddOrder from './AddOrder';
import { getDeadlineInfo, calculateOrderTotalTWD } from '../utils';

// 輔助函數：解析角色陣列，相容舊字串格式
const getItemRoles = (item) => {
  if (item.roles && Array.isArray(item.roles)) {
    return item.roles;
  }
  const charStr = item.character || item.role || '';
  return charStr ? charStr.split(',').map(s => s.trim()).filter(Boolean) : [];
};

export default function OrderDetail({ orderId, onBack }) {
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [selectedItemToSell, setSelectedItemToSell] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'receipt'

  // 監聽單一父訂單與關聯的子物品
  const order = useLiveQuery(() => db.orders.get(orderId), [orderId]);

  // 日常記帳防護：若是日常記帳，禁止進入此詳情頁，自動返回
  useEffect(() => {
    if (order && order.order_type === 'daily') {
      onBack();
    }
  }, [order, onBack]);

  const items = useLiveQuery(() => db.items.where({ order_id: orderId }).toArray(), [orderId]);

  // 監聽此訂單下所有子物品的售出紀錄
  const sales = useLiveQuery(async () => {
    if (!items || items.length === 0) return [];
    const itemIds = items.map(i => i.id);
    return await db.sales.where('item_id').anyOf(itemIds).toArray();
  }, [items]);

  if (!order) return <div className="p-4 h-full flex items-center justify-center text-gray-400 font-medium">載入中...</div>;

  // 運費與分攤設定 (整併為 shipping_fee)
  const shippingFee = Number(order.shipping_fee) || Number(order.global_shipping_fee) || 0;
  const allocationMethod = order.allocation_method || 'count';

  // 分攤計算引擎基礎資料準備
  const totalQty = items?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
  const totalPrice = items?.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) || 0;
  const totalWeight = items?.reduce((sum, item) => sum + ((Number(item.weight) || 0) * Number(item.quantity)), 0) || 0;

  // 更新訂單設定
  const handleUpdateOrder = async (changes) => {
    const parentOrder = await db.orders.get(orderId);
    if (parentOrder) {
      const mergedOrder = { ...parentOrder, ...changes };
      const currentItems = await db.items.where({ order_id: orderId }).toArray();
      const newTotalTWD = calculateOrderTotalTWD(mergedOrder, currentItems);
      
      await db.orders.update(orderId, {
        ...changes,
        total_amount_twd: newTotalTWD
      });
    }
  };

  // 刪除物品並連動更新總金額
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('確定要刪除此物品嗎？')) return;
    
    await db.items.delete(itemId);
    
    // 重新撈取該訂單所有的物品並計算總金額
    const currentItems = await db.items.where({ order_id: orderId }).toArray();
    const newTotal = currentItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    
    const parentOrder = await db.orders.get(orderId);
    if (parentOrder) {
      const updatedOrder = {
        ...parentOrder,
        total_amount: newTotal
      };
      const newTotalTWD = calculateOrderTotalTWD(updatedOrder, currentItems);
      await db.orders.update(orderId, { 
        total_amount: newTotal,
        total_amount_twd: newTotalTWD
      });
    }
  };

  // 刪除整筆訂單與級聯刪除邏輯
  const handleDeleteOrder = async () => {
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
      
      onBack();
    } catch (error) {
      console.error('刪除訂單失敗:', error);
      alert('刪除失敗，請重試');
    }
  };

  // 取得該單品的分攤運費 (單件 * 數量 = 總分攤運費)
  const getShippingAllocation = (item) => {
    if (shippingFee === 0) return 0;
    let ratio = 0;
    
    if (allocationMethod === 'count') {
      if (totalQty > 0) ratio = Number(item.quantity) / totalQty;
    } else if (allocationMethod === 'price') {
      if (totalPrice > 0) ratio = (Number(item.price) * Number(item.quantity)) / totalPrice;
    } else if (allocationMethod === 'weight') {
      if (totalWeight > 0) ratio = ((Number(item.weight) || 0) * Number(item.quantity)) / totalWeight;
    }
    
    return shippingFee * ratio;
  };

  // 計算每個物品的統計數據
  const getItemStats = (item) => {
    if (!sales) return { soldQty: 0, recoveredAmount: 0, remainingQty: item.quantity };
    const itemSales = sales.filter(s => s.item_id === item.id);
    const soldQty = itemSales.reduce((sum, s) => sum + Number(s.quantity), 0);
    const recoveredAmount = itemSales.reduce((sum, s) => sum + Number(s.price), 0);
    return {
      soldQty,
      recoveredAmount,
      remainingQty: Math.max(0, item.quantity - soldQty)
    };
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 relative animate-in slide-in-from-right-8 duration-300 transition-colors w-full max-w-4xl mx-auto md:my-6 md:rounded-2xl md:shadow-lg md:border md:border-gray-150 dark:md:border-gray-800 md:bg-white dark:md:bg-gray-900 overflow-hidden">
      
      {/* 頂部導覽列 */}
      <header className="flex items-center justify-between px-2 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shadow-sm sticky top-0 z-10 shrink-0 transition-colors">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors mr-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">訂單詳情</h1>
        </div>
        <div className="flex items-center gap-1.5 mr-1">
          {/* 小票與編輯模式切換 */}
          <button 
            onClick={() => setViewMode(viewMode === 'edit' ? 'receipt' : 'edit')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm border ${
              viewMode === 'receipt'
                ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                : 'bg-primary-light/50 dark:bg-gray-700/50 text-primary-dark dark:text-primary-light border-transparent hover:bg-primary-light dark:hover:bg-gray-700'
            }`}
            title={viewMode === 'edit' ? "切換至小票模式" : "切換至編輯模式"}
          >
            {viewMode === 'edit' ? (
              <>
                <span>🧾 小票模式</span>
              </>
            ) : (
              <>
                <span>📋 編輯模式</span>
              </>
            )}
          </button>

          {viewMode === 'edit' && (
            <>
              <button 
                onClick={() => setIsEditOrderOpen(true)}
                className="p-2 text-primary-dark dark:text-primary hover:bg-primary-light/50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
                title="編輯訂單"
              >
                <Pencil size={20} />
              </button>
              <button 
                onClick={handleDeleteOrder}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-colors"
                title="刪除訂單"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* 主要內容區 */}
      {viewMode === 'edit' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-32">
        
        {/* 父訂單摘要區塊 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/80 relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light/30 dark:bg-primary-dark/20 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="min-w-0 pr-4">
              <h2 className="font-bold text-gray-900 dark:text-gray-100 text-xl leading-tight truncate">
                {order.title || order.source}
              </h2>
              {order.title && order.source && (
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-1 truncate">
                  購買來源：{order.source}
                </p>
              )}
              {/* 訂單分類標籤 */}
              {order.tags && order.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {order.tags.map(t => (
                    <span 
                      key={t} 
                      className="text-[9px] bg-primary-light/50 dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light px-2 py-0.5 rounded font-bold shrink-0 shadow-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(() => {
              const statusInfo = getStatusStyle(order.status);
              return (
                <span 
                  className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 shadow-sm shrink-0 ${statusInfo.color}`}
                >
                  <span>{statusInfo.dot}</span>
                  <span>{statusInfo.label}</span>
                </span>
              );
            })()}
          </div>
          
          {/* 外幣金額 */}
          <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50 relative z-10">
            <div className="text-gray-500 dark:text-gray-400 font-medium">外幣總金額</div>
            <div className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-baseline gap-1.5">
              <span>
                {(() => {
                  const curr = CURRENCIES.find(c => c.code === order.currency);
                  const symbol = curr ? curr.symbol : (order.exchange_rate === 5.5 || order.exchange_rate === 0.23 ? '¥' : '$');
                  return `${symbol}${order.total_amount}`;
                })()}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                (結匯匯率: {order.exchange_rate})
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal ml-1">(由明細自動加總)</span>
            </div>
          </div>

          {/* 物流單號 */}
          <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50 relative z-10">
            <div className="text-gray-500 dark:text-gray-400 font-medium">物流單號</div>
            <div>
              {order.tracking_number ? (
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200 select-all">
                  {order.tracking_number}
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">尚未填寫</span>
              )}
            </div>
          </div>

          {/* 繳費期限 */}
          <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50 relative z-10">
            <div className="text-gray-500 dark:text-gray-400 font-medium">繳費期限</div>
            <div className="flex items-center gap-2">
              {order.payment_deadline ? (
                <>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                    {order.payment_deadline}
                  </span>
                  {order.status === '已喊單' && (() => {
                    const deadlineInfo = getDeadlineInfo(order.payment_deadline);
                    if (!deadlineInfo) return null;
                    return (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all border ${deadlineInfo.colorClass}`}>
                        {deadlineInfo.text}
                      </span>
                    );
                  })()}
                </>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">尚未填寫</span>
              )}
            </div>
          </div>
        </div>

        {/* 國際運費與分攤設定區塊 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-primary-light dark:border-primary-dark/50 flex flex-col gap-3 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={18} className="text-primary-dark dark:text-primary" />
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">國際運費與分攤設定</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">整筆訂單國際運費 (NT$)</label>
              <input
                type="number"
                min="0"
                value={shippingFee || ''}
                placeholder="0"
                onChange={(e) => handleUpdateOrder({ shipping_fee: Number(e.target.value) })}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-200 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">運費分攤基準</label>
              <div className="relative">
                <select
                  value={allocationMethod}
                  onChange={(e) => handleUpdateOrder({ allocation_method: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm appearance-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-200 outline-none transition-all"
                >
                  <option value="count">按件數平攤</option>
                  <option value="price">按外幣金額比例</option>
                  <option value="weight">按實際重量比例</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Percent size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 子物品清單區塊 */}
        <section>
          <div className="flex items-center justify-between px-1 mb-3 mt-1">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">包含物品</h3>
            <span className="text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-full transition-colors">
              共 {items?.length || 0} 項
            </span>
          </div>
          
          {!items || items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 border-dashed p-8 text-center flex flex-col items-center transition-colors">
              <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700/40 rounded-full flex justify-center items-center mb-3">
                <Package size={28} className="text-gray-300 dark:text-gray-500" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">尚未建立物品</p>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500">點擊右下角，開始拆分這筆訂單的品項</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => {
                const stats = getItemStats(item);
                const isSoldOut = stats.remainingQty <= 0;
                
                // 計算成本
                const allocatedShipping = getShippingAllocation(item);
                const itemBaseCostNTD = Number(item.price) * Number(item.quantity) * Number(order.exchange_rate);
                const finalTotalCost = Math.round(itemBaseCostNTD + allocatedShipping);

                return (
                  <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/80 flex flex-col transition-all hover:shadow-md">
                    {/* 上半部：物品基本資訊 */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const itemTags = item.tags && Array.isArray(item.tags)
                              ? item.tags
                              : (item.tag ? [item.tag] : []);
                            if (itemTags.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 shrink-0">
                                {itemTags.map((t, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-350 px-2 py-0.5 rounded-md font-bold"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                          <span className="font-bold text-gray-800 dark:text-gray-100 text-base">{item.name}</span>
                        </div>
                        {(() => {
                          const itemRoles = getItemRoles(item);
                          if (itemRoles.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {itemRoles.map((role, idx) => (
                                <span 
                                  key={idx} 
                                  className="bg-primary/10 dark:bg-primary-dark/20 text-primary-dark dark:text-primary-light px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center"
                                >
                                  🏷 {role}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-gray-800 dark:text-gray-200">
                          {(() => {
                            const curr = CURRENCIES.find(c => c.code === order.currency);
                            const symbol = curr ? curr.symbol : (order.exchange_rate === 5.5 || order.exchange_rate === 0.23 ? '¥' : '$');
                            return `${symbol}${item.price}`;
                          })()}
                        </div>
                        <div className="flex gap-1.5 justify-end mt-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded transition-colors">
                            {item.quantity} 件
                          </span>
                          {(item.weight > 0) && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded transition-colors">
                              {item.weight}g
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 中段：成本精算分析 */}
                    <div className="bg-gray-50/80 dark:bg-gray-900/60 rounded-xl p-3 my-2 flex justify-between items-center text-sm border border-gray-100/50 dark:border-gray-700/30 transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold w-12">本體台幣</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">NT$ {Math.round(itemBaseCostNTD).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-primary-dark dark:text-primary font-bold w-12">+ 分攤運費</span>
                          <span className="font-medium text-primary-dark dark:text-primary">NT$ {Math.round(allocatedShipping).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right border-l border-gray-200 dark:border-gray-700 pl-3">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-0.5">最終總成本</div>
                        <div className="text-base font-black text-primary-dark dark:text-primary">NT$ {finalTotalCost.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* 下半部：庫存與回血狀態 */}
                    <div className="pt-2 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-0.5">剩餘庫存</span>
                          <span className={`text-sm font-black ${isSoldOut ? 'text-gray-300 dark:text-gray-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {stats.remainingQty}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-0.5">已回血</span>
                          <span className={`text-sm font-black ${stats.recoveredAmount > 0 ? 'text-secondary-dark dark:text-secondary' : 'text-gray-400 dark:text-gray-500'}`}>
                            NT$ {stats.recoveredAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* 動作按鈕區 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary hover:bg-primary-light/30 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                          title="編輯物品"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                          title="刪除物品"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          disabled={isSoldOut}
                          onClick={() => setSelectedItemToSell({ item, stats })}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                            isSoldOut 
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:bg-emerald-200'
                          }`}
                        >
                          {isSoldOut ? (
                            '已售罄'
                          ) : (
                            <>
                              <DollarSign size={14} />
                              售出
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start pb-32 bg-gray-100 dark:bg-gray-900 transition-colors">
          <ReceiptView order={order} items={items} />
        </div>
      )}

      {/* FAB: 新增子物品 */}
      {viewMode === 'edit' && (
        <button 
          onClick={() => setIsAddItemOpen(true)}
          className="absolute bottom-6 right-5 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/40 hover:bg-primary-dark active:bg-primary-dark hover:-translate-y-1 transition-all z-40"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* 新增子物品表單 Modal */}
      {isAddItemOpen && (
        <AddItem orderId={orderId} onClose={() => setIsAddItemOpen(false)} />
      )}

      {/* 售出物品表單 Modal */}
      {selectedItemToSell && (
        <SellItem 
          item={selectedItemToSell.item} 
          remainingQty={selectedItemToSell.stats.remainingQty} 
          onClose={() => setSelectedItemToSell(null)} 
        />
      )}

      {/* 編輯訂單表單 Modal */}
      {isEditOrderOpen && order && (
        <AddOrder existingOrder={order} onClose={() => setIsEditOrderOpen(false)} />
      )}

      {/* 編輯子物品表單 Modal */}
      {editingItem && (
        <AddItem orderId={orderId} existingItem={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}

// ==========================================
// 步驟二十六.二：小票風格收據元件 (Receipt View)
// ==========================================
function ReceiptView({ order, items }) {
  const receiptRef = React.useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const currencySymbol = CURRENCIES.find(c => c.code === order.currency)?.symbol || '$';
  
  // 計算品項數量與外幣總額
  const totalQty = items?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
  
  // 計算品項台幣總額 (商品基數 A = 外幣單價 * 數量 * 匯率)
  const itemsTWDTotal = items?.reduce((sum, item) => {
    return sum + Math.round(Number(item.price) * Number(item.quantity) * Number(order.exchange_rate));
  }, 0) || 0;
  
  // 如果沒有 items 且 order.total_amount 有值，則 fallback 算商品基數 A
  const baseAmount = items && items.length > 0 
    ? itemsTWDTotal 
    : Math.round((Number(order.total_amount) || 0) * (Number(order.exchange_rate) || 1));

  // 新增/相容之進階費用計算
  const handlingFeePercent = Number(order.handling_fee_percent) || 0;
  const serviceFeePercent = Number(order.service_fee_percent) || 0;
  
  // 計算手續費與服務費金額
  const handlingFeeAmount = Math.round(baseAmount * (handlingFeePercent / 100));
  const serviceFeeAmount = Math.round(baseAmount * (serviceFeePercent / 100));
  
  // 各項費用 (相容舊欄位)
  const shippingFee = Number(order.shipping_fee) || Number(order.global_shipping_fee) || 0;
  const discountAmount = Number(order.discount_amount) || Number(order.discount) || 0;
  
  // 如果資料庫中已有 total_amount_twd，直接使用，否則跑計算公式做為 fallback
  const totalCost = order.total_amount_twd !== undefined 
    ? order.total_amount_twd 
    : Math.round(baseAmount + handlingFeeAmount + serviceFeeAmount + shippingFee - discountAmount);

  // 支付方式分配計算，預設為 ATM/轉帳
  const currentPaymentMethod = order.payment_method || 'ATM/轉帳';

  const handleDownloadJPG = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      // 設定優化參數，scale: 2 可以確保點陣字體與文字在放大時依然清晰不模糊
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#fdfbf7', // 確保底色完美還原紙張原色
        logging: false,
      });
      
      // 將 Canvas 轉換為 JPG 格式的 Data URL (畫質設為 0.9)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      // 建立虛擬 <a> 標籤觸發流暢下載
      const link = document.createElement('a');
      link.download = `CollectTrack_小票_${order?.title || order?.source || '未命名'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('圖片下載失敗:', error);
      alert('圖片產生失敗，請稍後再試');
    } finally {
      setIsDownloading(false);
    }
  };

  // 渲染模擬熱感應紙條碼
  const renderSimulatedBarcode = () => {
    const bars = [
      2, 1, 3, 1, 4, 2, 1, 3, 2, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 2, 3, 1, 1, 2, 4, 1, 3, 2
    ];
    return (
      <div className="flex justify-center items-center h-10 w-full gap-[2.5px] opacity-75 mt-3 select-none">
        {bars.map((w, idx) => (
          <div 
            key={idx} 
            className="h-full bg-gray-800" 
            style={{ width: `${w}px` }} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm animate-in fade-in">
      {/* 下載按鈕 */}
      <button
        onClick={handleDownloadJPG}
        disabled={isDownloading}
        className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 dark:shadow-amber-900/20 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2 select-none"
      >
        {isDownloading ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent animate-spin" />
            圖片產生中...
          </>
        ) : (
          <>
            <span>💾</span>
            下載為圖片 (JPG)
          </>
        )}
      </button>

      {/* 小票本體 */}
      <div 
        ref={receiptRef}
        className="w-full max-w-sm bg-[#fdfbf7] text-gray-800 shadow-lg relative font-mono text-xs select-text overflow-hidden rounded-md border border-amber-100/50"
      >
      
      {/* 頂部鋸齒邊緣 */}
      <div className="w-full h-3 text-[#fdfbf7] bg-gray-100 dark:bg-gray-900 fill-current rotate-180">
        <svg className="w-full h-full" viewBox="0 0 100 10" preserveAspectRatio="none">
          <polygon points="0,0 5,10 10,0 15,10 20,0 25,10 30,0 35,10 40,0 45,10 50,0 55,10 60,0 65,10 70,0 75,10 80,0 85,10 90,0 95,10 100,0" />
        </svg>
      </div>

      {/* 票身內容 */}
      <div className="p-6 space-y-4">
        
        {/* 票頭與 LOGO */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black tracking-widest text-gray-900 uppercase">
            CollectTrack
          </h2>
          <p className="text-[9px] text-gray-500 font-extrabold tracking-wider">
            ★ 週邊明細收據 ★
          </p>
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 表頭基本資訊 */}
        <div className="space-y-1 text-[11px] text-gray-700">
          <div className="flex justify-between">
            <span className="font-bold">賣家：</span>
            <span>{order.source}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">日期：</span>
            <span>{new Date(order.created_at || Date.now()).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">標籤：</span>
            <span>{order.tags && order.tags.length > 0 ? order.tags.join(', ') : '無'}</span>
          </div>
          {order.payment_deadline && (
            <div className="flex justify-between">
              <span className="font-bold">繳費期限：</span>
              <span>{order.payment_deadline}</span>
            </div>
          )}
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 明細區 */}
        <div className="space-y-2">
          {/* 明細表頭 */}
          <div className="grid grid-cols-12 gap-1 text-[11px] font-bold text-gray-900 pb-1">
            <span className="col-span-5 text-left">品名</span>
            <span className="col-span-2 text-center">數量</span>
            <span className="col-span-2 text-right">單價</span>
            <span className="col-span-3 text-right">金額</span>
          </div>

          {/* 細虛線 divider (---) */}
          <div className="border-t border-dashed border-gray-300 my-2"></div>
          
          {/* 商品清單 */}
          {items && items.length > 0 ? (
            <div className="space-y-2.5">
              {items.map((item) => {
                const itemTWD = Math.round(Number(item.price) * Number(item.quantity) * Number(order.exchange_rate));
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-1 text-[11px] items-start text-gray-800">
                    <div className="col-span-5 text-left break-all font-semibold leading-tight">
                      {item.name}
                      {(() => {
                        const itemRoles = getItemRoles(item);
                        if (itemRoles.length === 0) return null;
                        return (
                          <span className="text-[9px] text-gray-500 block font-normal mt-0.5">
                            ({itemRoles.join(', ')})
                          </span>
                        );
                      })()}
                    </div>
                    <span className="col-span-2 text-center font-mono font-semibold">{item.quantity}</span>
                    <span className="col-span-2 text-right font-mono font-semibold">{currencySymbol}{item.price}</span>
                    <span className="col-span-3 text-right font-mono font-bold">
                      NT${itemTWD}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-3 italic">
              (無物品明細紀錄)
            </div>
          )}

          {/* 細虛線 divider (---) */}
          <div className="border-t border-dashed border-gray-300 my-2"></div>

          {/* 項目總數 */}
          <div className="text-[11px] font-bold text-right text-gray-900 pr-1">
            項目總數：{totalQty} 件
          </div>
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 稅費與物流區 */}
        <div className="space-y-1.5 text-[11px] text-gray-700">
          {(handlingFeePercent > 0 || handlingFeeAmount > 0) && (
            <div className="flex justify-between">
              <span>手續費 ({handlingFeePercent}%)</span>
              <span className="font-semibold">NT$ {handlingFeeAmount}</span>
            </div>
          )}
          {(serviceFeePercent > 0 || serviceFeeAmount > 0) && (
            <div className="flex justify-between">
              <span>服務費 ({serviceFeePercent}%)</span>
              <span className="font-semibold">NT$ {serviceFeeAmount}</span>
            </div>
          )}
          {shippingFee > 0 && (
            <div className="flex justify-between">
              <span>運費</span>
              <span className="font-semibold">NT$ {shippingFee}</span>
            </div>
          )}
          {/* 對於舊訂單，如果有 global_shipping_fee 且 shipping_fee 為空/0，仍展示以供舊資料呈現 */}
          {!order.shipping_fee && order.global_shipping_fee > 0 && (
            <div className="flex justify-between">
              <span>二補 (含國際運/關稅)</span>
              <span className="font-bold">NT$ {order.global_shipping_fee}</span>
            </div>
          )}
        </div>

        {/* 優惠折扣區 */}
        {discountAmount > 0 && (
          <>
            {/* 細虛線 divider (---) */}
            <div className="border-t border-dashed border-gray-300 my-2"></div>
            <div className="flex justify-between text-[11px] text-red-600 font-bold">
              <span>折扣</span>
              <span>-NT$ {discountAmount}</span>
            </div>
          </>
        )}

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 總計區 */}
        <div className="flex justify-between items-baseline py-0.5 text-gray-900">
          <span className="text-xs font-black">總計</span>
          <span className="text-lg font-black tracking-tight">
            NT$ {totalCost.toLocaleString()}
          </span>
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 支付方式 */}
        <div className="space-y-1 text-[10px] text-gray-600">
          {PAYMENT_METHODS.map((method) => {
            const isMatched = currentPaymentMethod === method;
            const amount = isMatched ? totalCost : 0;
            return (
              <div key={method} className="flex justify-between">
                <span>[支付] {method}</span>
                <span className="font-semibold">NT$ {amount.toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 備註區 */}
        <div className="text-[10px] text-gray-600 space-y-1">
          <div className="font-bold text-gray-700">備註：</div>
          <div className="break-words whitespace-pre-wrap leading-normal font-sans">
            {order.remark || order.notes || '無備註資訊。'}
          </div>
        </div>

        {/* 粗虛線 divider (===) */}
        <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

        {/* 條碼與感謝詞 */}
        <div className="text-center space-y-2">
          <div className="text-[10px] text-gray-500 font-bold leading-normal">
            感謝您使用 COLLECTTRACK！
            <br />
            ★ 祝您吃谷愉快，抽卡必出推！ ★
          </div>
          
          <div className="space-y-0.5">
            {renderSimulatedBarcode()}
            <div className="text-[8px] text-gray-400 tracking-[0.2em] font-mono">
              *{order.id?.toString().padStart(6, '0')}*
            </div>
          </div>
        </div>

      </div>

      {/* 底部鋸齒邊緣 */}
      <div className="w-full h-3 text-[#fdfbf7] bg-gray-100 dark:bg-gray-900 fill-current">
        <svg className="w-full h-full" viewBox="0 0 100 10" preserveAspectRatio="none">
          <polygon points="0,0 5,10 10,0 15,10 20,0 25,10 30,0 35,10 40,0 45,10 50,0 55,10 60,0 65,10 70,0 75,10 80,0 85,10 90,0 95,10 100,0" />
        </svg>
      </div>

      </div>
    </div>
  );
}
