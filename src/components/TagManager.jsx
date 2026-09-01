import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Plus, Trash2, Pencil, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { db } from '../db';

export default function TagManager({ onClose }) {
  const [activeTab, setActiveTab] = useState('anime'); // 'anime'
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');

  // 訂閱資料庫標籤
  const customTags = useLiveQuery(() => db.custom_tags.toArray()) || [];

  // 過濾並依照 sort_order 排序
  const currentCategoryTags = customTags
    .filter(t => t.category === activeTab)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // 新增標籤
  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const nextSortOrder = currentCategoryTags.reduce((max, t) => Math.max(max, t.sort_order || 0), 0) + 1;
      await db.custom_tags.add({
        name: newTagName.trim(),
        category: activeTab,
        parent_id: null,
        sort_order: nextSortOrder
      });
      setNewTagName('');
    } catch (err) {
      console.error('新增標籤失敗:', err);
      alert('新增標籤失敗，請重試');
    }
  };

  // 開始編輯標籤
  const startEdit = (tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  // 儲存編輯
  const saveEdit = async (tagId) => {
    if (!editingTagName.trim()) return;
    try {
      await db.custom_tags.update(tagId, { name: editingTagName.trim() });
      setEditingTagId(null);
    } catch (err) {
      console.error('更新標籤失敗:', err);
      alert('更新標籤失敗，請重試');
    }
  };

  // 刪除標籤
  const handleDeleteTag = async (tag) => {
    if (!window.confirm(`確定要刪除標籤「${tag.name}」嗎？\n這不會刪除已套用此標籤的訂單，但此標籤未來將不再出現在快速選擇中。`)) return;

    try {
      await db.custom_tags.delete(tag.id);
      // 刪除後，重新調整剩餘標籤的 sort_order 使其連續
      const remaining = customTags
        .filter(t => t.category === activeTab && t.id !== tag.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      await db.transaction('rw', db.custom_tags, async () => {
        for (let i = 0; i < remaining.length; i++) {
          await db.custom_tags.update(remaining[i].id, { sort_order: i + 1 });
        }
      });
    } catch (err) {
      console.error('刪除標籤失敗:', err);
      alert('刪除標籤失敗，請重試');
    }
  };

  // 上移標籤 (sort_order 變小)
  const handleMoveUp = async (index) => {
    if (index === 0) return;
    try {
      const current = currentCategoryTags[index];
      const prev = currentCategoryTags[index - 1];
      
      const tempOrder = current.sort_order;
      await db.transaction('rw', db.custom_tags, async () => {
        await db.custom_tags.update(current.id, { sort_order: prev.sort_order });
        await db.custom_tags.update(prev.id, { sort_order: tempOrder });
      });
    } catch (err) {
      console.error('排序更新失敗:', err);
    }
  };

  // 下移標籤 (sort_order 變大)
  const handleMoveDown = async (index) => {
    if (index === currentCategoryTags.length - 1) return;
    try {
      const current = currentCategoryTags[index];
      const next = currentCategoryTags[index + 1];
      
      const tempOrder = current.sort_order;
      await db.transaction('rw', db.custom_tags, async () => {
        await db.custom_tags.update(current.id, { sort_order: next.sort_order });
        await db.custom_tags.update(next.id, { sort_order: tempOrder });
      });
    } catch (err) {
      console.error('排序更新失敗:', err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* 點擊背景關閉 (手機版) */}
      <div className="absolute inset-0 md:hidden" onClick={onClose}></div>

      {/* 面板主體 */}
      <div className="bg-white dark:bg-gray-900 w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-none md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300 transition-colors z-10">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0 transition-colors">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>標籤大師管理面板</span>
        </h2>
        <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <X size={20} />
        </button>
      </div>



      {/* 主要內容滾動區 */}
      <div className="flex-1 overflow-y-auto p-5 pb-32 md:pb-5 space-y-4">
        
        {/* 新增標籤輸入框 */}
        <form onSubmit={handleAddTag} className="flex gap-2">
          <input
            type="text"
            required
            maxLength={10}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder={`輸入新${activeTab === 'general' ? '記帳' : '週邊'}標籤...`}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-none px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={!newTagName.trim()}
            className="px-4 bg-primary text-white rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-primary/20 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shrink-0"
          >
            <Plus size={18} strokeWidth={2.5} className="mr-1" />
            <span>新增</span>
          </button>
        </form>

        {/* 標籤列表 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <span>標籤名稱</span>
            <span>排序調整 & 操作</span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-gray-100 dark:border-gray-700/80 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/80 transition-colors">
            {currentCategoryTags.map((tag, index) => {
              const isEditing = editingTagId === tag.id;
              
              return (
                <div 
                  key={tag.id}
                  className="flex items-center justify-between p-3 px-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {/* 左側：編輯中或顯示名稱 */}
                  <div className="flex-1 min-w-0 pr-4">
                    {isEditing ? (
                      <input
                        type="text"
                        maxLength={10}
                        value={editingTagName}
                        onChange={(e) => setEditingTagName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-gray-800 dark:text-gray-100"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate block">
                        {tag.name}
                      </span>
                    )}
                  </div>

                  {/* 右側：動作按鈕群 */}
                  <div className="flex items-center gap-1 shrink-0">
                    
                    {/* 編輯確認與取消 */}
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(tag.id)}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-none transition-colors"
                          title="儲存"
                        >
                          <Check size={15} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => setEditingTagId(null)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-none transition-colors"
                          title="取消"
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* 排序上移 */}
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary disabled:opacity-20 rounded-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="上移"
                        >
                          <ChevronUp size={16} />
                        </button>
                        
                        {/* 排序下移 */}
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === currentCategoryTags.length - 1}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary disabled:opacity-20 rounded-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="下移"
                        >
                          <ChevronDown size={16} />
                        </button>

                        {/* 分隔線 */}
                        <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

                        {/* 編輯名稱 */}
                        <button
                          onClick={() => startEdit(tag)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary rounded-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="修改名稱"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* 刪除標籤 */}
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-none transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                          title="刪除標籤"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {currentCategoryTags.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 italic">
                尚未建立任何標籤，請於上方輸入框新增。
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer 關閉按鈕 */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex shrink-0 transition-colors">
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-none font-bold hover:bg-gray-200 dark:hover:bg-gray-650 active:scale-98 transition-all"
        >
          關閉面板
        </button>
      </div>

    </div>
    </div>
  );
}
