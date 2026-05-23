import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Pencil, Trash2, Tag, User } from 'lucide-react';
import { db } from '../db';

export default function TagRoleManager({ onClose }) {
  const [activeTab, setActiveTab] = useState('tags'); // 'tags' | 'roles'
  const orders = useLiveQuery(() => db.orders.toArray()) || [];
  const items = useLiveQuery(() => db.items.toArray()) || [];

  // 計算不重複標籤及其頻率
  const tags = React.useMemo(() => {
    const counts = {};
    orders.forEach(order => {
      if (Array.isArray(order.tags)) {
        order.tags.forEach(t => {
          const val = t.trim();
          if (val) counts[val] = (counts[val] || 0) + 1;
        });
      }
    });
    items.forEach(item => {
      const itemTags = Array.isArray(item.tags)
        ? item.tags
        : (item.tag ? [item.tag] : []);
      itemTags.forEach(t => {
        const val = t.trim();
        if (val) counts[val] = (counts[val] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders, items]);

  // 計算不重複角色及其頻率
  const roles = React.useMemo(() => {
    const counts = {};
    items.forEach(item => {
      const itemRoles = Array.isArray(item.roles)
        ? item.roles
        : (item.character ? item.character.split(',').map(s => s.trim()).filter(Boolean) : (item.role ? [item.role] : []));
      itemRoles.forEach(r => {
        const val = r.trim();
        if (val) counts[val] = (counts[val] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // 編輯重新命名邏輯
  const handleRename = async (oldName, type) => {
    const newName = window.prompt(`將【${oldName}】更名為：`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmedNew = newName.trim();

    try {
      if (type === 'tags') {
        const tablesToLock = ['orders', 'items'];
        if (db.custom_tags) tablesToLock.push('custom_tags');
        
        await db.transaction('rw', tablesToLock, async () => {
          // 1. 更新 orders
          await db.orders.toCollection().modify(order => {
            if (Array.isArray(order.tags) && order.tags.includes(oldName)) {
              order.tags = order.tags.map(t => t === oldName ? trimmedNew : t);
            }
          });
          // 2. 更新 items
          await db.items.toCollection().modify(item => {
            const currentTags = Array.isArray(item.tags)
              ? item.tags
              : (item.tag ? [item.tag] : []);
            if (currentTags.includes(oldName) || item.tag === oldName) {
              item.tags = currentTags.map(t => t === oldName ? trimmedNew : t);
              item.tag = item.tags[0] || '';
            }
          });
          // 3. 更新 custom_tags 表的預設標籤（若存在）
          if (db.custom_tags) {
            const presets = await db.custom_tags.where({ name: oldName }).toArray();
            for (let p of presets) {
              await db.custom_tags.update(p.id, { name: trimmedNew });
            }
          }
        });
      } else {
        await db.transaction('rw', ['items'], async () => {
          // 更新 items 角色
          await db.items.toCollection().modify(item => {
            const currentRoles = Array.isArray(item.roles)
              ? item.roles
              : (item.character ? item.character.split(',').map(s => s.trim()).filter(Boolean) : (item.role ? [item.role] : []));
            if (currentRoles.includes(oldName) || item.role === oldName) {
              item.roles = currentRoles.map(r => r === oldName ? trimmedNew : r);
              item.character = item.roles.join(', ');
              if (item.role === oldName) {
                item.role = trimmedNew;
              }
            }
          });
        });
      }
      alert('更名成功！');
    } catch (err) {
      console.error('更名失敗:', err);
      alert('更新失敗，請稍後重試');
    }
  };

  // 刪除邏輯
  const handleDelete = async (name, type) => {
    const msg = type === 'tags' 
      ? `確定要刪除標籤【${name}】嗎？\n此動作將會從所有已使用的訂單與物品中移除此標籤（不會刪除物品本身）。`
      : `確定要刪除角色【${name}】嗎？\n此動作將會從所有已使用的物品中移除此角色。`;

    if (!window.confirm(msg)) return;

    try {
      if (type === 'tags') {
        const tablesToLock = ['orders', 'items'];
        if (db.custom_tags) tablesToLock.push('custom_tags');
        
        await db.transaction('rw', tablesToLock, async () => {
          // 1. 刪除 orders 標籤
          await db.orders.toCollection().modify(order => {
            if (Array.isArray(order.tags) && order.tags.includes(name)) {
              order.tags = order.tags.filter(t => t !== name);
            }
          });
          // 2. 刪除 items 標籤
          await db.items.toCollection().modify(item => {
            const currentTags = Array.isArray(item.tags)
              ? item.tags
              : (item.tag ? [item.tag] : []);
            if (currentTags.includes(name) || item.tag === name) {
              item.tags = currentTags.filter(t => t !== name);
              item.tag = item.tags[0] || '';
            }
          });
          // 3. 刪除 custom_tags 表中同名的預設標籤（若存在）
          if (db.custom_tags) {
            await db.custom_tags.where({ name }).delete();
          }
        });
      } else {
        await db.transaction('rw', ['items'], async () => {
          // 刪除 items 角色
          await db.items.toCollection().modify(item => {
            const currentRoles = Array.isArray(item.roles)
              ? item.roles
              : (item.character ? item.character.split(',').map(s => s.trim()).filter(Boolean) : (item.role ? [item.role] : []));
            if (currentRoles.includes(name) || item.role === name) {
              item.roles = currentRoles.filter(r => r !== name);
              item.character = item.roles.join(', ');
              if (item.role === name) {
                item.role = '';
              }
            }
          });
        });
      }
      alert('刪除成功！');
    } catch (err) {
      console.error('刪除失敗:', err);
      alert('刪除失敗，請稍後重試');
    }
  };

  const currentList = activeTab === 'tags' ? tags : roles;

  return (
    <div 
      className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300 transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>🏷️ 標籤與角色管理中心</span>
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab 切換 */}
        <div className="px-5 pt-4 shrink-0 bg-white dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800/50 pb-3 transition-colors">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl transition-colors">
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'tags'
                  ? 'bg-white dark:bg-gray-700 text-primary-dark dark:text-primary-light shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Tag size={14} />
              一般標籤 (Tags)
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'roles'
                  ? 'bg-white dark:bg-gray-700 text-primary-dark dark:text-primary-light shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <User size={14} />
              角色標籤 (Roles)
            </button>
          </div>
        </div>

        {/* 標籤/角色列表區 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {currentList.length === 0 ? (
            <div className="text-center text-gray-400 py-10 font-medium text-sm">
              目前系統中尚未有已記錄的{activeTab === 'tags' ? '標籤' : '角色'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {currentList.map(({ name, count }) => (
                <div key={name} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 border-b border-gray-100 dark:border-gray-850">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">
                      {name}
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                      使用 {count} 次
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    <button
                      onClick={() => handleRename(name, activeTab)}
                      className="p-1.5 text-gray-400 hover:text-primary-dark dark:hover:text-primary hover:bg-primary-light/30 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="編輯名稱"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(name, activeTab)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer 關閉按鈕 */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex shrink-0 transition-colors">
          <button 
            type="button" 
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-650 active:bg-gray-300 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
