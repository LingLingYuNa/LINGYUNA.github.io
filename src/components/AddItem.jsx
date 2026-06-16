import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Image as ImageIcon } from 'lucide-react';
import { db } from '../db';
import { DEFAULT_TAGS } from '../constants';
import { compressImage, calculateOrderTotalTWD } from '../utils';

export default function AddItem({ orderId, existingItem, onClose }) {
  const [name, setName] = useState(existingItem?.name || '');
  
  // 角色改為多選標籤模式，向下相容舊資料欄位 character 與 role
  const [roles, setRoles] = useState(
    existingItem?.roles || 
    (existingItem?.character ? [existingItem.character] : (existingItem?.role ? [existingItem.role] : []))
  );
  
  const [quantity, setQuantity] = useState(existingItem?.quantity || 1);
  const [price, setPrice] = useState(existingItem?.price || '');
  const [weight, setWeight] = useState(existingItem?.weight || '');
  const [selectedTags, setSelectedTags] = useState(
    existingItem?.tags || (existingItem?.tag ? [existingItem.tag] : [])
  );
  const isUrl = (str) => typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
  const [images, setImages] = useState(
    existingItem?.images || 
    (existingItem?.image ? [existingItem.image] : [])
  );
  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [ip, setIp] = useState(existingItem?.ip || '');

  // 屬性設定彈跳視窗狀態與臨時狀態
  const [isPropModalOpen, setIsPropModalOpen] = useState(false);
  const [tempIp, setTempIp] = useState('');
  const [tempRoles, setTempRoles] = useState([]);
  const [tempTags, setTempTags] = useState([]);
  const [tempRoleInput, setTempRoleInput] = useState('');
  const [tempTagInput, setTempTagInput] = useState('');

  const dbCustomTags = useLiveQuery(() => db.custom_tags ? db.custom_tags.toArray() : Promise.resolve([])) || [];
  const dbItems = useLiveQuery(() => db.items.toArray()) || [];

  // 合併並去重標籤
  const availableTags = React.useMemo(() => {
    const tagsSet = new Set(DEFAULT_TAGS);
    
    dbCustomTags.forEach(t => {
      if (t.name) tagsSet.add(t.name.trim());
    });
    
    dbItems.forEach(item => {
      if (item.tag) {
        tagsSet.add(item.tag.trim());
      }
      if (Array.isArray(item.tags)) {
        item.tags.forEach(t => {
          if (t) tagsSet.add(t.trim());
        });
      }
    });
    
    return Array.from(tagsSet).filter(t => t !== '');
  }, [dbCustomTags, dbItems]);

  // 基於 temp 狀態計算過濾後的製品標籤推薦
  const filteredAvailableTags = React.useMemo(() => {
    return availableTags.filter(tag => 
      !tempTags.includes(tag) && 
      tag.toLowerCase().includes(tempTagInput.toLowerCase())
    );
  }, [availableTags, tempTags, tempTagInput]);

  // 提取所有已存在的角色作為選項
  const availableRoles = React.useMemo(() => {
    const rolesSet = new Set();
    
    dbItems.forEach(item => {
      const itemRoles = Array.isArray(item.roles)
        ? item.roles
        : (item.character ? item.character.split(',').map(s => s.trim()).filter(Boolean) : (item.role ? [item.role] : []));
      
      itemRoles.forEach(r => {
        if (r) rolesSet.add(r.trim());
      });
    });
    
    return Array.from(rolesSet).filter(r => r !== '');
  }, [dbItems]);
 
  const DEFAULT_IPS = ['原神', '崩壞•星穹鐵道'];
  // 提取所有已存在的 IP 作為選項
  const availableIPs = React.useMemo(() => {
    const ipsSet = new Set(DEFAULT_IPS);
    dbItems.forEach(item => {
      if (item.ip) ipsSet.add(item.ip.trim());
    });
    return Array.from(ipsSet).filter(Boolean);
  }, [dbItems]);

  // 基於 temp 狀態計算過濾後的角色推薦
  const filteredAvailableRoles = React.useMemo(() => {
    return availableRoles.filter(role => 
      !tempRoles.includes(role) && 
      role.toLowerCase().includes(tempRoleInput.toLowerCase())
    );
  }, [availableRoles, tempRoles, tempRoleInput]);

  // 屬性設定彈跳視窗操作方法
  const handleOpenPropModal = () => {
    setTempIp(ip);
    setTempRoles([...roles]);
    setTempTags([...selectedTags]);
    setTempRoleInput('');
    setTempTagInput('');
    setIsPropModalOpen(true);
  };

  const handleConfirmProps = () => {
    setIp(tempIp);
    setRoles(tempRoles);
    setSelectedTags(tempTags);
    setIsPropModalOpen(false);
  };

  const handleAddTempRole = (roleToAddOrEvent) => {
    let roleToAdd = '';
    if (typeof roleToAddOrEvent === 'string') {
      roleToAdd = roleToAddOrEvent;
    } else {
      if (roleToAddOrEvent) roleToAddOrEvent.preventDefault();
      roleToAdd = tempRoleInput;
    }

    const trimmed = roleToAdd.trim();
    if (trimmed && !tempRoles.includes(trimmed)) {
      setTempRoles([...tempRoles, trimmed]);
    }
    setTempRoleInput('');
  };

  const handleRemoveTempRole = (indexToRemove) => {
    setTempRoles(tempRoles.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddTempTag = (tagToAdd) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !tempTags.includes(trimmed)) {
      setTempTags([...tempTags, trimmed]);
    }
    setTempTagInput('');
  };

  const handleRemoveTempTag = (tagToRemove) => {
    setTempTags(tempTags.filter(t => t !== tagToRemove));
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        const compressedList = [];
        for (const file of files) {
          const compressed = await compressImage(file);
          compressedList.push(compressed);
        }
        setImages(prev => [...prev, ...compressedList]);
      } catch (error) {
        console.error('圖片壓縮失敗:', error);
      }
      // 重置 input value 以免重複選擇同一張圖不觸發 onChange
      e.target.value = '';
    }
  };

  const handleAddUrlImage = (e) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (trimmed) {
      setImages(prev => [...prev, trimmed]);
      setUrlInput('');
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !price) return;

    setIsSaving(true);
    try {
      const itemData = {
        order_id: orderId,
        name,
        ip, // 新增 IP 欄位
        roles: roles,
        character: roles.join(', '),
        tags: selectedTags,
        quantity: Number(quantity),
        price: Number(price),
        weight: Number(weight) || 0,
        image: images[0] || '',
        images: images,
      };

      if (existingItem) {
        const updatedItem = {
          ...existingItem,
          ...itemData,
        };
        // 兼容性覆寫：從資料庫物件中刪除舊有的單一字串欄位
        delete updatedItem.tag;
        delete updatedItem.role;
        
        await db.items.put(updatedItem);
      } else {
        await db.items.add({
          ...itemData,
          created_at: new Date().toISOString(),
        });
      }

      // 重新撈取該訂單所有的物品並計算總金額，連動更新父訂單
      const allItems = await db.items.where({ order_id: orderId }).toArray();
      const newTotal = allItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      
      const parentOrder = await db.orders.get(orderId);
      if (parentOrder) {
        const updatedOrder = {
          ...parentOrder,
          total_amount: newTotal
        };
        const newTotalTWD = calculateOrderTotalTWD(updatedOrder, allItems);
        await db.orders.update(orderId, { 
          total_amount: newTotal,
          total_amount_twd: newTotalTWD
        });
      }

      onClose(); // 儲存後關閉
    } catch (error) {
      console.error('新增物品失敗:', error);
      alert('寫入失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // 全螢幕彈出層 (Mobile-First) + 電腦版置中卡片
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900 md:bg-gray-950/60 md:backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-gray-900 w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {existingItem ? '編輯物品' : '新增物品'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 pb-32 md:pb-5 space-y-6">
          
          {/* 品名 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">品名</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：壓克力立牌、特典小卡..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 週邊屬性卡片 */}
          <div className="bg-gray-150/50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                🏷️ 週邊屬性設定
              </span>
              <button
                type="button"
                onClick={handleOpenPropModal}
                className="text-xs font-bold text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-sm"
              >
                {(ip || roles.length > 0 || selectedTags.length > 0) ? '編輯屬性' : '設定屬性'}
              </button>
            </div>
            
            {/* 已選屬性展示 */}
            {(ip || roles.length > 0 || selectedTags.length > 0) ? (
              <div className="space-y-2.5">
                {/* 作品 (IP) */}
                {ip && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0">作品：</span>
                    <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg font-bold border border-purple-100/50 dark:border-purple-900/50">
                      {ip}
                    </span>
                  </div>
                )}
                
                {/* 角色 */}
                {roles.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0 mt-1">角色：</span>
                    <div className="flex flex-wrap gap-1">
                      {roles.map((role, idx) => (
                        <span key={idx} className="bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-lg font-bold border border-pink-100/50 dark:border-pink-900/50">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 製品 */}
                {selectedTags.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0 mt-1">製品：</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.map((tag) => (
                        <span key={tag} className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg font-bold border border-blue-100/50 dark:border-blue-900/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                尚未設定作品、角色或製品標籤。
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 外幣單價 */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">外幣單價</label>
              <input
                type="number"
                required
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            {/* 數量 */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">數量</label>
              <input
                type="number"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* 重量 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">單件重量 (g) (選填)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 照片上傳與 URL 貼上 */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              照片 (選填，支援多張圖片)
            </label>
            
            {/* 多圖滾動預覽區 */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-250 dark:scrollbar-thumb-gray-700">
              {images.length > 0 ? (
                images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="w-20 h-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden shrink-0 shadow-sm transition-all group"
                  >
                    {isUrl(img) ? (
                      <div className="w-full h-full relative">
                        <img 
                          src={img} 
                          alt={`網址預覽-${idx}`} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.classList.add('hidden');
                            e.currentTarget.nextSibling.classList.remove('hidden');
                            e.currentTarget.nextSibling.classList.add('flex');
                          }}
                        />
                        <div className="hidden w-full h-full flex-col items-center justify-center bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400">
                          <X size={16} />
                        </div>
                      </div>
                    ) : (
                      <img src={img} alt={`本地預覽-${idx}`} className="w-full h-full object-cover" />
                    )}
                    
                    {/* 懸浮移除單張照片按鈕 */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="移除照片"
                    >
                      <X size={20} />
                    </button>
                    
                    {/* 標記第一張為封面 */}
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                        封面
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 dark:border-gray-750 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center shrink-0">
                  <ImageIcon className="text-gray-400 dark:text-gray-655" size={24} />
                  <span className="text-[10px] text-gray-400 dark:text-gray-550 mt-1">無照片</span>
                </div>
              )}
            </div>

            {/* 上傳與輸入區塊 */}
            <div className="space-y-3">
              {/* 檔案上傳按鈕 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">上傳本地圖片：</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border file:border-gray-250 dark:file:border-gray-650 file:text-xs file:font-semibold file:bg-gray-50 dark:file:bg-gray-800 file:text-gray-700 dark:text-gray-300 hover:file:bg-gray-100 dark:hover:file:bg-gray-750 transition-colors w-full cursor-pointer"
                />
              </div>
              
              {/* 網址輸入與加入按鈕 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">新增外部圖片網址：</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddUrlImage();
                        }
                      }}
                      placeholder="🔗 貼上圖片網址 (Image URL)..."
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-3 pr-8 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                    {urlInput && (
                      <button
                        type="button"
                        onClick={() => setUrlInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddUrlImage}
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-colors shrink-0"
                  >
                    ➕ 加入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer 動作按鈕 */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] transition-colors">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-705 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-650 active:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !name || !price}
            className="flex-1 py-3.5 px-4 bg-primary text-white rounded-xl font-semibold shadow-sm shadow-primary/30 hover:bg-primary-dark active:bg-primary-dark transition-colors disabled:opacity-50 disabled:shadow-none"
          >
            {isSaving ? '儲存中...' : (existingItem ? '儲存變更' : '儲存')}
          </button>
        </div>
      </div>

      {/* 三合一屬性設定彈跳視窗 */}
      {isPropModalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsPropModalOpen(false); }}
          className="fixed inset-0 z-[70] bg-gray-950/40 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6"
        >
          <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-200">
            
            {/* 標題列 */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                ⚙️ 屬性設定 (IP/角色/製品)
              </h3>
              <button 
                type="button" 
                onClick={() => setIsPropModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 內容滾動區 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* 1. 作品 (IP) 選擇區 */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                  1. 作品 (IP)
                </h4>
                {availableIPs.length > 0 && (
                  <div className="flex gap-2 flex-wrap pb-1">
                    {availableIPs.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTempIp(option)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          tempIp === option
                            ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900 shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-550 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-750'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={tempIp}
                    onChange={(e) => setTempIp(e.target.value)}
                    placeholder="或輸入自訂作品名稱..."
                    className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {tempIp && (
                    <button
                      type="button"
                      onClick={() => setTempIp('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. 角色選擇區 */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">
                  2. 角色 (選填)
                </h4>
                
                {/* 角色推薦 Pills */}
                {filteredAvailableRoles.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap max-h-24 overflow-y-auto pb-1 scrollbar-none">
                    {filteredAvailableRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setTempRoles([...tempRoles, role])}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 border border-transparent transition-all"
                      >
                        + {role}
                      </button>
                    ))}
                  </div>
                )}

                {/* 角色自訂手動輸入 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={tempRoleInput}
                      onChange={(e) => setTempRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tempRoleInput.trim()) {
                            handleAddTempRole(tempRoleInput.trim());
                          }
                        }
                      }}
                      placeholder="輸入新角色..."
                      className="w-full bg-gray-55 dark:bg-gray-805 border border-gray-150 dark:border-gray-750 rounded-l-xl pl-3.5 pr-8 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                    {tempRoleInput && (
                      <button
                        type="button"
                        onClick={() => setTempRoleInput('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTempRole(tempRoleInput)}
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-r-xl font-bold text-xs transition-colors shrink-0"
                  >
                    ➕ 新增
                  </button>
                </div>

                {/* 當前已選擇的角色 */}
                {tempRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tempRoles.map((role, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 px-2.5 py-1 rounded-full text-xs font-semibold border border-pink-100/50 dark:border-pink-900/50"
                      >
                        {role}
                        <button
                          type="button"
                          onClick={() => handleRemoveTempRole(idx)}
                          className="hover:bg-pink-100 dark:hover:bg-pink-900/60 rounded-full p-0.5 transition-colors text-pink-500 dark:text-pink-400"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. 製品/製品標籤 (Tags) 選擇區 */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">
                  3. 製品/屬性標籤 (Tags) (選填)
                </h4>
                
                {/* 製品標籤推薦 Pills */}
                {filteredAvailableTags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap max-h-24 overflow-y-auto pb-1 scrollbar-none">
                    {filteredAvailableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTempTags([...tempTags, tag])}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-55 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 border border-transparent transition-all"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* 製品自訂手動輸入 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={tempTagInput}
                      onChange={(e) => setTempTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tempTagInput.trim()) {
                            handleAddTempTag(tempTagInput.trim());
                          }
                        }
                      }}
                      placeholder="輸入新標籤..."
                      className="w-full bg-gray-55 dark:bg-gray-805 border border-gray-150 dark:border-gray-750 rounded-l-xl pl-3.5 pr-8 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                    {tempTagInput && (
                      <button
                        type="button"
                        onClick={() => setTempTagInput('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTempTag(tempTagInput)}
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-r-xl font-bold text-xs transition-colors shrink-0"
                  >
                    ➕ 新增
                  </button>
                </div>

                {/* 當前已選擇的製品標籤 */}
                {tempTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tempTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-100 dark:border-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTempTag(tag)}
                          className="hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-full p-0.5 transition-colors text-blue-500 dark:text-blue-455"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* 底部確定/取消動作欄 */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-850 p-4 pb-safe flex gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
              <button
                type="button"
                onClick={() => setIsPropModalOpen(false)}
                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-255 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmProps}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-semibold shadow-sm shadow-primary/30 hover:bg-primary-dark active:bg-primary-dark transition-colors text-xs"
              >
                確認設定
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
