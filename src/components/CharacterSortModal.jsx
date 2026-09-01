import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, ArrowUp, ArrowDown, Trash2, Plus, Sparkles, Settings, ListFilter } from 'lucide-react';
import { db } from '../db';
import { useHardwareBack } from '../hooks/useHardwareBack';

export default function CharacterSortModal({ onClose }) {
  const [nameInput, setNameInput] = useState('');
  const characterOrders = useLiveQuery(
    () => db.character_sort_orders ? db.character_sort_orders.orderBy('sort_order').toArray() : Promise.resolve([]),
    []
  ) || [];

  useHardwareBack(true, onClose, 'character-sort-modal');

  // 新增角色至排序庫
  const handleAddCharacter = async (e) => {
    e?.preventDefault();
    const name = nameInput.trim();
    if (!name) return;

    const existing = characterOrders.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      alert(`「${name}」已在角色排序庫中！`);
      return;
    }

    const nextOrder = characterOrders.length > 0 ? Math.max(...characterOrders.map(c => c.sort_order || 0)) + 1 : 1;
    await db.character_sort_orders.add({
      name,
      sort_order: nextOrder,
      created_at: new Date().toISOString()
    });
    setNameInput('');
  };

  // 載入預設熱門角色建議
  const handleLoadPresets = async () => {
    const presets = ['鍾離', '胡桃', '魈', '卡芙卡', '流螢', '黃泉', '砂金', '知更鳥'];
    let currentMax = characterOrders.length > 0 ? Math.max(...characterOrders.map(c => c.sort_order || 0)) : 0;
    
    const newItems = [];
    for (const name of presets) {
      if (!characterOrders.some(c => c.name === name)) {
        currentMax++;
        newItems.push({
          name,
          sort_order: currentMax,
          created_at: new Date().toISOString()
        });
      }
    }
    if (newItems.length > 0) {
      await db.character_sort_orders.bulkAdd(newItems);
    }
  };

  // 上移角色
  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const current = characterOrders[index];
    const prev = characterOrders[index - 1];

    await db.transaction('rw', db.character_sort_orders, async () => {
      await db.character_sort_orders.update(current.id, { sort_order: prev.sort_order });
      await db.character_sort_orders.update(prev.id, { sort_order: current.sort_order });
    });
  };

  // 下移角色
  const handleMoveDown = async (index) => {
    if (index === characterOrders.length - 1) return;
    const current = characterOrders[index];
    const next = characterOrders[index + 1];

    await db.transaction('rw', db.character_sort_orders, async () => {
      await db.character_sort_orders.update(current.id, { sort_order: next.sort_order });
      await db.character_sort_orders.update(next.id, { sort_order: current.sort_order });
    });
  };

  // 刪除角色
  const handleDelete = async (id) => {
    await db.character_sort_orders.delete(id);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors">
      <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 rounded-xl">
              <Settings size={18} />
            </span>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">全域角色排序庫設定</h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">排序靠前的角色將自動優先排列品項</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 新增輸入框區 */}
        <div className="p-4 bg-gray-50 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <form onSubmit={handleAddCharacter} className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="輸入角色名稱 (如: 鍾離, 胡桃)..."
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-1 shrink-0 active:scale-95"
            >
              <Plus size={16} />
              <span>新增</span>
            </button>
          </form>

          {characterOrders.length === 0 && (
            <button
              type="button"
              onClick={handleLoadPresets}
              className="mt-2.5 w-full py-2 px-3 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-150 dark:border-purple-900/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-purple-100 transition-all active:scale-[0.99]"
            >
              <Sparkles size={14} />
              <span>一鍵填入預設二次元熱門角色排序</span>
            </button>
          )}
        </div>

        {/* 角色順序列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {characterOrders.length > 0 ? (
            characterOrders.map((item, idx) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-150 dark:border-gray-750 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveUp(idx)}
                    className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-primary-light disabled:opacity-30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="向上移"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === characterOrders.length - 1}
                    onClick={() => handleMoveDown(idx)}
                    className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-primary-light disabled:opacity-30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="向下移"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1"
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 space-y-2 flex flex-col items-center">
              <ListFilter size={32} className="text-gray-400" />
              <p className="text-xs font-medium">排序庫目前尚無角色。</p>
              <p className="text-[10px] text-gray-400">請在上方輸入角色名稱點擊新增，建立專屬的角色優先級順序！</p>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            完成設定
          </button>
        </div>
      </div>
    </div>
  );
}
