import Dexie from 'dexie';

// 建立資料庫實例
export const db = new Dexie('CollectTrackDB');

// 定義 schema 結構
db.version(1).stores({
  orders: '++id, status, source, created_at',
  items: '++id, order_id, name, character'
});

// V2 擴充：新增售出紀錄資料表
db.version(2).stores({
  sales: '++id, item_id, created_at'
});

// V3 擴充：新增自訂標籤與訂單名稱欄位索引
db.version(3).stores({
  orders: '++id, status, source, title, created_at',
  custom_tags: '++id, name, category, parent_id, sort_order'
});

// 初始化預設標籤 (當 custom_tags 為空時寫入資料)
db.on('ready', () => {
  // 檢查表格是否已定義（防止升級時還未就緒）
  if (!db.custom_tags) return;
  
  return db.custom_tags.count().then(count => {
    if (count === 0) {
      const defaultTags = [
        { name: '食', category: 'general', parent_id: null, sort_order: 1 },
        { name: '衣', category: 'general', parent_id: null, sort_order: 2 },
        { name: '住', category: 'general', parent_id: null, sort_order: 3 },
        { name: '行', category: 'general', parent_id: null, sort_order: 4 },
        { name: '育', category: 'general', parent_id: null, sort_order: 5 },
        { name: '樂', category: 'general', parent_id: null, sort_order: 6 },
        { name: '立牌', category: 'anime', parent_id: null, sort_order: 1 },
        { name: '徽章', category: 'anime', parent_id: null, sort_order: 2 },
        { name: '色紙', category: 'anime', parent_id: null, sort_order: 3 },
        { name: '拍立得', category: 'anime', parent_id: null, sort_order: 4 },
        { name: '黏土人', category: 'anime', parent_id: null, sort_order: 5 },
        { name: '比例模型', category: 'anime', parent_id: null, sort_order: 6 },
      ];
      return db.custom_tags.bulkAdd(defaultTags);
    }
  }).catch(err => {
    console.error('初始化自訂標籤失敗:', err);
  });
});
