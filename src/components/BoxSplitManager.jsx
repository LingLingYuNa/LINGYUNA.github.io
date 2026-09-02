import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, ArrowUpDown, Image as ImageIcon, Settings, Trash2, Calendar, Package } from 'lucide-react';
import { db } from '../db';
import AddBoxSplitModal from './AddBoxSplitModal';
import BoxSplitDetail from './BoxSplitDetail';
import CharacterSortModal from './CharacterSortModal';

export default function BoxSplitManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' (新→舊) | 'oldest' (舊→新)
  const [selectedSplitId, setSelectedSplitIdState] = useState(() => {
    const saved = localStorage.getItem('box_split_selected_id');
    return saved ? Number(saved) : null;
  });

  const setSelectedSplitId = (id) => {
    setSelectedSplitIdState(id);
    if (id) {
      localStorage.setItem('box_split_selected_id', String(id));
    } else {
      localStorage.removeItem('box_split_selected_id');
    }
  };
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
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32 bg-[#f7f1df] dark:bg-[#121212] min-h-screen">
      
      {/* 頁面標題區 */}
      <header className="px-1 mt-2 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase text-black dark:text-white tracking-wider flex items-center gap-2">
            <Package size={28} strokeWidth={2.5} />
            <span>揪拆團小助手</span>
          </h1>
          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-mono font-bold">
            盲盒、週邊拆團與代購喊單分攤管理工具 (BOX SPLIT MANAGER)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCharacterSortOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FFE66D] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            title="設定全域角色排序庫"
          >
            <Settings size={15} strokeWidth={2.5} />
            <span>角色排序庫</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B6B] text-white border-2 border-black font-black text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer uppercase"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>新增拆團</span>
          </button>
        </div>
      </header>

      {/* 搜尋列與排序按鈕 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black pointer-events-none" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋拆團名稱或標籤..."
            className="w-full bg-white text-black font-mono font-bold border-4 border-black pl-10 pr-4 py-2.5 text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)] transition-all placeholder:text-gray-500"
          />
        </div>

        {/* 排序按鈕 */}
        <button
          onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#4ECDC4] text-black border-4 border-black font-black text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all shrink-0 cursor-pointer"
        >
          <ArrowUpDown size={14} strokeWidth={2.5} />
          <span>{sortOrder === 'newest' ? '新 → 舊' : '舊 → 新'}</span>
        </button>
      </div>

      {/* 拆團卡片牆列表 */}
      <div className="space-y-4">
        {filteredSplits.length > 0 ? (
          filteredSplits.map((split) => {
            const splitItems = items.filter(i => i.box_split_id === split.id);
            const firstItemImage = splitItems.find(i => i.image)?.image;
            const displayImage = split.cover_image || firstItemImage;

            return (
              <div
                key={split.id}
                onClick={() => setSelectedSplitId(split.id)}
                className="bg-white dark:bg-gray-800 p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer flex gap-4 group relative"
              >
                {/* 卡片左側圖片 */}
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={split.title}
                    className="w-24 h-24 object-cover border-2 border-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  />
                ) : (
                  <div className="w-24 h-24 bg-[#FFE66D] flex flex-col items-center justify-center text-black shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black">
                    <ImageIcon size={28} strokeWidth={2.5} />
                    <span className="text-[10px] mt-1 font-mono uppercase">無圖片</span>
                  </div>
                )}

                {/* 卡片右側資訊 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-base text-black dark:text-white uppercase line-clamp-1">
                        {split.title}
                      </h3>
                      {/* 進度標籤 */}
                      <span className="px-2.5 py-0.5 text-xs font-black bg-[#FF6B6B] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        {split.status || '已喊單'}
                      </span>
                    </div>

                    {/* 標籤 */}
                    {split.tags && split.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {split.tags.map((t, idx) => (
                          <span key={idx} className="bg-[#4ECDC4] text-black text-[10px] font-black px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t-2 border-black dark:border-white">
                    {/* 日期 */}
                    <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-mono font-bold">
                      <Calendar size={13} strokeWidth={2.5} />
                      <span>{split.date || (split.created_at ? split.created_at.split('T')[0] : '')}</span>
                    </div>

                    {/* 總金額與刪除 */}
                    <div className="flex items-center gap-3">
                      <span className="font-black text-base text-black dark:text-white font-mono">
                        NT$ {split.total_amount ? Number(split.total_amount).toLocaleString() : '0'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSplit(e, split.id)}
                        className="p-1.5 bg-[#F38181] text-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF6B6B] transition-colors cursor-pointer"
                        title="刪除拆團"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black space-y-3 flex flex-col items-center">
            <Package size={48} strokeWidth={2.5} />
            <p className="text-sm font-black uppercase text-black dark:text-white">目前尚無拆團紀錄</p>
            <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">點擊右上角「+ 新增拆團」按鈕建立第一筆揪拆團紀錄！</p>
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

