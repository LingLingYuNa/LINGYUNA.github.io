import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, ArrowUpDown, Image as ImageIcon, Settings, Trash2, Calendar } from 'lucide-react';
import { db } from '../db';
import AddBoxSplitModal from './AddBoxSplitModal';
import BoxSplitDetail from './BoxSplitDetail';
import CharacterSortModal from './CharacterSortModal';

export default function BoxSplitManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' (新→舊) | 'oldest' (舊→新)
  const [selectedSplitId, setSelectedSplitId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCharacterSortOpen, setIsCharacterSortOpen] = useState(false);

  // 讀取所有拆團紀錄
  const splits = useLiveQuery(
    () => db.box_splits ? db.box_splits.toArray() : Promise.resolve([]),
    []
  ) || [];

  // 讀取所有品項 (用於為無封面的拆團提供預設圖片)
  const items = useLiveQuery(
    () => db.box_split_items ? db.box_split_items.toArray() : Promise.resolve([]),
    []
  ) || [];

  // 過濾與排序拆團清單
  const filteredSplits = splits.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const titleMatch = s.title && s.title.toLowerCase().includes(q);
    const tagMatch = s.tags && Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(q));
    return titleMatch || tagMatch;
  }).sort((a, b) => {
    const timeA = new Date(a.created_at || a.date || 0).getTime();
    const timeB = new Date(b.created_at || b.date || 0).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  // 刪除拆團及其附屬品項與喊單
  const handleDeleteSplit = async (e, splitId) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除此拆團紀錄嗎？其附屬的品項與喊單紀錄將一併被刪除且無法復原。')) {
      await db.transaction('rw', db.box_splits, db.box_split_items, db.box_split_participants, async () => {
        await db.box_splits.delete(splitId);
        await db.box_split_items.where('box_split_id').equals(splitId).delete();
        await db.box_split_participants.where('box_split_id').equals(splitId).delete();
      });
    }
  };

  // 若選擇了特定拆團，切換至拆團詳情頁
  if (selectedSplitId) {
    return (
      <BoxSplitDetail
        splitId={selectedSplitId}
        onBack={() => setSelectedSplitId(null)}
      />
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32">
      
      {/* 頁面標題區 (手繪稿 2: 揪拆團小助手) */}
      <header className="px-1 mt-2 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
            <span>📦</span>
            <span>揪拆團小助手</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            盲盒、週邊拆團與代購喊單分攤管理工具
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCharacterSortOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold shadow-xs hover:bg-gray-50 transition-all active:scale-95"
            title="設定全域角色排序庫"
          >
            <Settings size={15} />
            <span>角色排序庫</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>新增拆團</span>
          </button>
        </div>
      </header>

      {/* 手繪稿 2: 搜尋列與排序按鈕 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋拆團名稱或標籤..."
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
          />
        </div>

        {/* 排序按鈕 (手繪稿 2: 舊→新 / 新→舊) */}
        <button
          onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-all shrink-0 active:scale-95"
        >
          <ArrowUpDown size={14} />
          <span>{sortOrder === 'newest' ? '新 → 舊' : '舊 → 新'}</span>
        </button>
      </div>

      {/* 手繪稿 2: 拆團卡片牆列表 */}
      <div className="space-y-4">
        {filteredSplits.length > 0 ? (
          filteredSplits.map((split) => {
            // 計算此拆團預設圖片 (若拆團無封面，取第一個品項的圖片)
            const splitItems = items.filter(i => i.box_split_id === split.id);
            const firstItemImage = splitItems.find(i => i.image)?.image;
            const displayImage = split.cover_image || firstItemImage;

            return (
              <div
                key={split.id}
                onClick={() => setSelectedSplitId(split.id)}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700/80 hover:border-primary/40 transition-all cursor-pointer flex gap-4 group relative"
              >
                {/* 手繪稿 2: 卡片左側圖片 */}
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={split.title}
                    className="w-24 h-24 object-cover rounded-xl border border-gray-150 dark:border-gray-700 shrink-0 group-hover:scale-102 transition-transform"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-gray-700/60 flex flex-col items-center justify-center text-gray-400 shrink-0 border border-gray-200 dark:border-gray-700">
                    <ImageIcon size={28} />
                    <span className="text-[10px] mt-1 font-medium">無圖片</span>
                  </div>
                )}

                {/* 手繪稿 2: 卡片右側資訊 (團名、標籤、日期、進度、總金額) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-base text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors line-clamp-1">
                        {split.title}
                      </h3>
                      {/* 進度標籤 */}
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                        {split.status || '已喊單'}
                      </span>
                    </div>

                    {/* 標籤 */}
                    {split.tags && split.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {split.tags.map((t, idx) => (
                          <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    {/* 揪拆團日期 */}
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 font-medium">
                      <Calendar size={13} />
                      <span>{split.date || (split.created_at ? split.created_at.split('T')[0] : '')}</span>
                    </div>

                    {/* 總金額 */}
                    <div className="flex items-center gap-3">
                      <span className="font-black text-base text-primary-dark dark:text-primary-light">
                        NT$ {split.total_amount ? Number(split.total_amount).toLocaleString() : '0'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSplit(e, split.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="刪除拆團"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-750 text-gray-400 space-y-3">
            <span className="text-4xl block">📦</span>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">目前尚無拆團紀錄</p>
            <p className="text-xs text-gray-400">點擊右上角「+ 新增拆團」按鈕建立第一筆揪拆團紀錄！</p>
          </div>
        )}
      </div>

      {/* 彈窗 1：新增拆團 Modal */}
      {isAddModalOpen && (
        <AddBoxSplitModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(newId) => setSelectedSplitId(newId)}
        />
      )}

      {/* 彈窗 2：全域角色排序庫 Modal */}
      {isCharacterSortOpen && (
        <CharacterSortModal
          onClose={() => setIsCharacterSortOpen(false)}
        />
      )}
    </div>
  );
}
