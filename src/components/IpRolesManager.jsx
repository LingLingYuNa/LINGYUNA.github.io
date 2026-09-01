import React, { useState } from 'react';
import { X, Pencil, Trash2, Plus } from 'lucide-react';

export default function IpRolesManager({ onClose }) {
  const DEFAULT_IP_ROLES = {
    '原神': ['鍾離', '胡桃', '魈', '×××'],
    '崩壞•星穹鐵道': ['卡芙卡', '流螢', '黃泉', '000']
  };

  // 從 localStorage 載入資料
  const [ipRolesMap, setIpRolesMap] = useState(() => {
    const saved = localStorage.getItem('collecttrack_ip_roles_map');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('解析 IP-Roles 對應表失敗:', e);
      }
    }
    return DEFAULT_IP_ROLES;
  });

  // 編輯與新增的狀態
  const [isEditing, setIsEditing] = useState(false);
  const [editTargetIp, setEditTargetIp] = useState(''); // 空表示新增，非空表示編輯舊有的 IP Key
  const [ipInput, setIpInput] = useState('');
  const [rolesInput, setRolesInput] = useState('');

  // 刪除
  const handleDeleteIp = (ipKey) => {
    if (window.confirm(`確定要刪除作品【${ipKey}】的推薦角色設定嗎？`)) {
      const newMap = { ...ipRolesMap };
      delete newMap[ipKey];
      setIpRolesMap(newMap);
      localStorage.setItem('collecttrack_ip_roles_map', JSON.stringify(newMap));
    }
  };

  // 開啟編輯/新增
  const handleOpenEdit = (ipKey = '') => {
    if (ipKey) {
      // 編輯
      setEditTargetIp(ipKey);
      setIpInput(ipKey);
      setRolesInput((ipRolesMap[ipKey] || []).join(', '));
    } else {
      // 新增
      setEditTargetIp('');
      setIpInput('');
      setRolesInput('');
    }
    setIsEditing(true);
  };

  // 儲存
  const handleSave = () => {
    const trimmedIp = ipInput.trim();
    if (!trimmedIp) {
      alert('請輸入作品 (IP) 名稱！');
      return;
    }

    const parsedRoles = rolesInput
      .split(/[,，\s\n]+/)
      .map(r => r.trim())
      .filter(Boolean);

    let newMap = { ...ipRolesMap };

    // 如果是編輯，且修改了 IP 名稱 (Key)
    if (editTargetIp && editTargetIp !== trimmedIp) {
      delete newMap[editTargetIp];
    }

    newMap[trimmedIp] = parsedRoles;
    setIpRolesMap(newMap);
    localStorage.setItem('collecttrack_ip_roles_map', JSON.stringify(newMap));
    setIsEditing(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !isEditing) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 w-full h-full md:w-full md:max-w-xl md:h-auto md:max-h-[85vh] md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300 transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>IP 常用角色推薦管理</span>
          </h2>
          <button 
            onClick={onClose} 
            disabled={isEditing}
            className="p-2 text-gray-400 dark:text-gray-550 hover:text-gray-655 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-755 transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* 編輯 / 新增面板 */}
        {isEditing ? (
          <div className="flex-1 p-5 space-y-4 flex flex-col overflow-y-auto pb-32 md:pb-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 pb-2">
              {editTargetIp ? `編輯 IP：${editTargetIp}` : '新增 IP 推薦角色'}
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">作品名稱 (IP)</label>
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="例如：原神"
                className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col min-h-[150px]">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                常用角色推薦 (以逗號、空格或換行分隔)
              </label>
              <textarea
                value={rolesInput}
                onChange={(e) => setRolesInput(e.target.value)}
                placeholder="例如：鍾離, 胡桃, 魈, ×××"
                className="w-full flex-1 bg-gray-55 dark:bg-gray-855 border border-gray-200 dark:border-gray-750 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 resize-none min-h-[120px]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors text-xs"
              >
                儲存
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 內容清單區 */}
            <div className="flex-1 overflow-y-auto p-5 pb-32 md:pb-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800/80">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">作品與推薦角色對應表</span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit()}
                  className="px-3 py-1.5 text-[10px] bg-primary text-white rounded-xl shadow-sm hover:bg-primary-dark active:scale-95 transition-all flex items-center gap-1 font-bold"
                >
                  <Plus size={12} /> 新增作品
                </button>
              </div>

              {Object.keys(ipRolesMap).length === 0 ? (
                <div className="text-center text-gray-405 py-12 italic text-sm">
                  目前無設定任何 IP 角色推薦。
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(ipRolesMap).map(([ipKey, roleList]) => (
                    <div 
                      key={ipKey}
                      className="p-3.5 bg-gray-55 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800/50 flex flex-col gap-2 transition-all hover:shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-purple-700 dark:text-purple-300 text-sm">
                          {ipKey}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(ipKey)}
                            className="p-1.5 text-gray-400 hover:text-primary-dark dark:hover:text-primary hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
                            title="編輯設定"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteIp(ipKey)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-red-950/20 rounded-lg transition-all"
                            title="刪除設定"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {roleList.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {roleList.map((role) => (
                            <span 
                              key={role}
                              className="text-[10px] bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 border border-pink-100/50 dark:border-pink-900/50 px-2 py-0.5 rounded-lg font-semibold"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">無設定角色推薦</span>
                      )}
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
          </>
        )}
      </div>
    </div>
  );
}
