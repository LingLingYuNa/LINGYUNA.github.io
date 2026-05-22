import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Settings, ShieldAlert, DatabaseBackup, Tags, Cloud, RefreshCw, LogOut } from 'lucide-react';
import { db } from '../db';
import TagManager from './TagManager';
import { requestAuth, uploadBackup, downloadBackup, disconnectGoogleDrive, getGoogleTokenClient } from '../utils/googleDriveSync';

export default function Tools() {
  const fileInputRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  // 雲端同步相關狀態
  const [isLinked, setIsLinked] = useState(() => {
    return localStorage.getItem('google_drive_linked') === 'true';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');

  useEffect(() => {
    // 嘗試在載入時初始化 Google SDK Client
    if (typeof window.google !== 'undefined') {
      getGoogleTokenClient();
    }
  }, []);

  // 連結 Google 帳號
  const handleConnect = async () => {
    setIsSyncing(true);
    setSyncStatusText('正在連結 Google 帳號...');
    try {
      await requestAuth();
      setIsLinked(true);
      alert('✅ 成功連結 Google 帳號！您現在可以使用雲端備份與還原功能。');
    } catch (error) {
      console.error('連結失敗:', error);
      alert('❌ 連結 Google 帳號失敗：\n' + (error.message || '授權被取消或發生錯誤'));
    } finally {
      setIsSyncing(false);
      setSyncStatusText('');
    }
  };

  // 解除連結
  const handleDisconnect = () => {
    if (window.confirm('確定要解除 Google 帳號的雲端同步連結嗎？這只會清除本機的登入 Token，不會刪除您雲端硬碟中的備份檔案。')) {
      disconnectGoogleDrive();
      setIsLinked(false);
      alert('已成功解除雲端同步連結。');
    }
  };

  // 雲端備份
  const handleCloudBackup = async () => {
    setIsSyncing(true);
    setSyncStatusText('正在準備資料...');
    try {
      // 1. 取得最新資料
      const orders = await db.orders.toArray();
      const items = await db.items.toArray();
      const sales = await db.sales.toArray();

      const backupData = {
        version: 2,
        export_date: new Date().toISOString(),
        data: { orders, items, sales }
      };

      setSyncStatusText('正在上傳至 Google 雲端硬碟...');
      
      // 2. 呼傳 (含 Token 過期續接機制)
      try {
        await uploadBackup(backupData);
      } catch (err) {
        if (err.message === 'TOKEN_EXPIRED' || err.message === 'NOT_LINKED') {
          setSyncStatusText('授權已過期，正在重新取得授權...');
          await requestAuth();
          setIsLinked(true);
          setSyncStatusText('授權成功，正在上傳至 Google 雲端硬碟...');
          await uploadBackup(backupData);
        } else {
          throw err;
        }
      }
      
      alert('✅ 雲端備份成功！已更新至您的 Google 雲端硬碟。');
    } catch (error) {
      console.error('雲端備份失敗:', error);
      alert('❌ 雲端備份失敗：\n' + (error.message || '發生未知錯誤'));
    } finally {
      setIsSyncing(false);
      setSyncStatusText('');
    }
  };

  // 雲端還原
  const handleCloudRestore = async () => {
    const confirmMsg = `⚠️ 警告：這將會【覆蓋與合併】您目前的本機資料庫，且無法復原，確定要從雲端還原嗎？`;
    if (!window.confirm(confirmMsg)) return;

    setIsSyncing(true);
    setSyncStatusText('正在連結 Google 雲端硬碟...');
    try {
      let backupData = null;
      
      // 1. 呼叫下載 (含 Token 過期續接機制)
      try {
        backupData = await downloadBackup();
      } catch (err) {
        if (err.message === 'TOKEN_EXPIRED' || err.message === 'NOT_LINKED') {
          setSyncStatusText('授權已過期，正在重新取得授權...');
          await requestAuth();
          setIsLinked(true);
          setSyncStatusText('授權成功，正在載入雲端備份...');
          backupData = await downloadBackup();
        } else {
          throw err;
        }
      }

      // 2. 判斷備份是否存在
      if (!backupData) {
        alert('ℹ️ 雲端硬碟中尚未有備份檔案 (CollectTrack_Backup.json)。請先執行「備份至雲端」。');
        return;
      }

      setSyncStatusText('正在還原資料庫...');
      
      // 3. 匯入資料
      const { data } = backupData;
      if (!data || !data.orders || !data.items) {
        throw new Error('下載的備份檔案格式不符合 CollectTrack 規範');
      }

      const salesData = data.sales || [];

      await db.transaction('rw', db.orders, db.items, db.sales, async () => {
        if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
        if (data.items.length > 0) await db.items.bulkPut(data.items);
        if (salesData.length > 0) await db.sales.bulkPut(salesData);
      });

      alert('✅ 雲端還原成功！系統將自動重新載入以套用最新資料。');
      window.location.reload();
    } catch (error) {
      console.error('雲端還原失敗:', error);
      alert('❌ 雲端還原失敗：\n' + (error.message || '下載或寫入資料庫時發生錯誤'));
    } finally {
      setIsSyncing(false);
      setSyncStatusText('');
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // 格式化時間 (YYYYMMDD_HHMM)
  const getFormattedDate = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  };

  // 匯出功能
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const orders = await db.orders.toArray();
      const items = await db.items.toArray();
      const sales = await db.sales.toArray();

      const backupData = {
        version: 2, // 備份檔格式版本號
        export_date: new Date().toISOString(),
        data: { orders, items, sales }
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `CollectTrack_Backup_${getFormattedDate()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('匯出失敗:', error);
      alert('匯出失敗，請重試！');
    } finally {
      setIsExporting(false);
    }
  };

  // 觸發選擇檔案
  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 讀取並匯入
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        
        // 基本格式防呆驗證
        const { data } = parsed;
        if (!data || !data.orders || !data.items || (!data.sales && parsed.version >= 2)) {
          throw new Error('此 JSON 檔案不是有效的 CollectTrack 備份檔');
        }

        // 容錯機制 (舊版可能沒有 sales)
        const salesData = data.sales || [];

        const confirmMsg = `即將匯入資料\n包含：\n- ${data.orders.length} 筆訂單\n- ${data.items.length} 筆物品\n- ${salesData.length} 筆售出紀錄\n\n注意：這將會【覆蓋與合併】您目前的資料庫，確定要繼續嗎？`;
        
        if (window.confirm(confirmMsg)) {
          setIsImporting(true);
          
          // 使用 Dexie Transaction 確保交易完整性 (要馬全寫入，要馬全失敗)
          await db.transaction('rw', db.orders, db.items, db.sales, async () => {
            if (data.orders.length > 0) await db.orders.bulkPut(data.orders);
            if (data.items.length > 0) await db.items.bulkPut(data.items);
            if (salesData.length > 0) await db.sales.bulkPut(salesData);
          });
          
          alert('✅ 匯入成功！系統將自動重新載入以套用最新資料。');
          window.location.reload();
        }
      } catch (error) {
        console.error('匯入失敗:', error);
        alert('❌ 匯入失敗：\n' + (error.message || '檔案解析發生錯誤'));
      } finally {
        setIsImporting(false);
        // 清除 input，允許重複匯入同一個檔案
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* 標題區 */}
      <header className="px-1 mt-2 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">系統工具</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">備份與管理你的本地資料庫</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 資料安全提示面板 */}
        <div className="md:col-span-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex gap-3 shadow-sm">
          <ShieldAlert className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-amber-800 dark:text-amber-300 font-bold text-sm mb-1">隱私與本地存儲安全</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed font-medium">
              CollectTrack 採用無後端的純本地儲存 (IndexedDB)，資料 100% 留在你的手機內。建議你**定期使用下方功能匯出備份**，或**連結 Google Drive 雲端同步**，以免更換手機或清除瀏覽器快取時遺失心血。
            </p>
          </div>
        </div>

        {/* 左欄：本地與雲端備份 */}
        <div className="space-y-6">
          {/* 本地備份與還原 */}
          <section className="space-y-3">
            <h3 className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <DatabaseBackup size={18} className="text-gray-500" />
              本地備份與還原
            </h3>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 overflow-hidden">
              {/* 匯出按鈕 */}
              <button 
                onClick={handleExport}
                disabled={isExporting || isImporting}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/40 active:bg-gray-100 dark:active:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700/80 disabled:opacity-50"
              >
                <div className="flex flex-col text-left">
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">匯出 JSON 備份檔</span>
                  <span className="text-xs text-gray-400 dark:text-gray-400 font-medium mt-0.5">將所有資料打包下載到裝置中</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Download size={20} strokeWidth={2.5} />
                </div>
              </button>

              {/* 匯入按鈕 */}
              <button 
                onClick={triggerImport}
                disabled={isExporting || isImporting}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/40 active:bg-gray-100 dark:active:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <div className="flex flex-col text-left">
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">匯入還原資料</span>
                  <span className="text-xs text-gray-400 dark:text-gray-400 font-medium mt-0.5">從之前的備份檔還原或合併資料</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Upload size={20} strokeWidth={2.5} />
                </div>
              </button>
              
              {/* 隱藏的檔案上傳 input */}
              <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                onChange={handleImport} 
                className="hidden" 
              />
            </div>
          </section>

          {/* 雲端同步 Google Drive */}
          <section className="space-y-3">
            <h3 className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Cloud size={18} className="text-blue-500 dark:text-blue-400" />
              雲端同步 (Google Drive)
            </h3>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 space-y-4">
              {/* 狀態列 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isLinked ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    {isLinked ? '已連結 Google 帳號' : '尚未連結 Google 帳號'}
                  </span>
                </div>
                {isLinked && (
                  <button 
                    onClick={handleDisconnect}
                    disabled={isSyncing}
                    className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <LogOut size={12} />
                    解除連結
                  </button>
                )}
              </div>

              {/* 核心說明與按鈕 */}
              {!isLinked ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    連結您的 Google 帳號後，CollectTrack 會直接將資料備份至您個人的雲端硬碟。此功能僅限存取由本 App 建立的檔案 (CollectTrack_Backup.json)，安全有保障。
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isSyncing}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-500/10 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>正在連結...</span>
                      </>
                    ) : (
                      <>
                        <Cloud size={16} />
                        <span>連結 Google 帳號</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    您已將此裝置與 Google 帳號連結。備份檔案會以私有格式存放在您雲端硬碟的 <span className="font-semibold text-gray-700 dark:text-gray-300">CollectTrack_Backup.json</span> 中。
                  </p>

                  {/* 同步中 Loading 顯示 */}
                  {isSyncing && (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center gap-2.5">
                      <RefreshCw size={16} className="text-blue-500 animate-spin" />
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">{syncStatusText || '同步中，請稍候...'}</span>
                    </div>
                  )}

                  {/* 還原與備份操作按鈕 */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCloudBackup}
                      disabled={isSyncing}
                      className="py-3 px-4 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-[0.99] transition-all disabled:opacity-50 animate-fade-in"
                    >
                      <Upload size={16} />
                      <span>備份至雲端</span>
                    </button>
                    <button
                      onClick={handleCloudRestore}
                      disabled={isSyncing}
                      className="py-3 px-4 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-650 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      <Download size={16} />
                      <span>從雲端還原</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 右欄：標籤管理與系統設定 */}
        <div className="space-y-6">
          {/* 標籤管理 */}
          <section className="space-y-3">
            <h3 className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Tags size={18} className="text-gray-500" />
              標籤管理
            </h3>
            <button 
              type="button"
              onClick={() => setIsTagManagerOpen(true)}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 active:bg-gray-100 dark:active:bg-gray-750"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">標籤大師管理面板</span>
                <span className="text-xs text-gray-400 dark:text-gray-400 font-medium mt-0.5">自訂分類標籤與排序順序</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-light dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light flex items-center justify-center">
                <Tags size={20} strokeWidth={2.5} />
              </div>
            </button>
          </section>

          {/* 系統設定 */}
          <section className="space-y-3">
            <h3 className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Settings size={18} className="text-gray-500" />
              系統設定
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 flex items-center justify-between transition-colors">
              <div className="flex flex-col text-left">
                <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">深色模式 (Dark Mode)</span>
                <span className="text-xs text-gray-400 dark:text-gray-400 font-medium mt-0.5">切換系統配色為深色主題</span>
              </div>
              {/* 切換 Toggle 按鈕 */}
              <button
                onClick={toggleDarkMode}
                className={`w-14 h-8 rounded-full transition-all relative outline-none focus:outline-none ${
                  isDarkMode ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all shadow-md ${
                    isDarkMode ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* 標籤管理面版 Modal */}
      {isTagManagerOpen && (
        <TagManager onClose={() => setIsTagManagerOpen(false)} />
      )}
    </div>
  );
}
