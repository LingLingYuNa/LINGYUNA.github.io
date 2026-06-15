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
  const [roleInput, setRoleInput] = useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  
  const [quantity, setQuantity] = useState(existingItem?.quantity || 1);
  const [price, setPrice] = useState(existingItem?.price || '');
  const [weight, setWeight] = useState(existingItem?.weight || '');
  const [selectedTags, setSelectedTags] = useState(
    existingItem?.tags || (existingItem?.tag ? [existingItem.tag] : [])
  );
  const [tagInput, setTagInput] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const isUrl = (str) => typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
  const [images, setImages] = useState(
    existingItem?.images || 
    (existingItem?.image ? [existingItem.image] : [])
  );
  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const filteredAvailableTags = availableTags.filter(tag => 
    !selectedTags.includes(tag) && 
    tag.toLowerCase().includes(tagInput.toLowerCase())
  );

  const handleAddTag = (tagToAdd) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setTagInput('');
    setIsTagDropdownOpen(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

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

  const filteredAvailableRoles = availableRoles.filter(role => 
    !roles.includes(role) && 
    role.toLowerCase().includes(roleInput.toLowerCase())
  );

  const handleAddRole = (roleToAddOrEvent) => {
    let roleToAdd = '';
    if (typeof roleToAddOrEvent === 'string') {
      roleToAdd = roleToAddOrEvent;
    } else {
      if (roleToAddOrEvent) roleToAddOrEvent.preventDefault();
      roleToAdd = roleInput;
    }

    const trimmed = roleToAdd.trim();
    if (trimmed && !roles.includes(trimmed)) {
      setRoles([...roles, trimmed]);
    }
    setRoleInput('');
    setIsRoleDropdownOpen(false);
  };

  const handleRemoveRole = (indexToRemove) => {
    setRoles(roles.filter((_, idx) => idx !== indexToRemove));
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
          {/* 分類標籤 (多選與動態載入) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">分類標籤</label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex flex-1 relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setIsTagDropdownOpen(true);
                    }}
                    onFocus={() => setIsTagDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (tagInput.trim()) {
                          handleAddTag(tagInput.trim());
                        }
                      }
                    }}
                    placeholder="輸入新標籤..."
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-xl pl-4 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {tagInput && (
                    <button
                      type="button"
                      onClick={() => setTagInput('')}
                      className="absolute right-[88px] top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full z-10"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-r-xl font-bold text-sm transition-colors shrink-0"
                  >
                    ➕ 新增
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                  className="px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-300 rounded-xl transition-all flex items-center justify-center font-semibold text-xs shrink-0"
                >
                  選擇 ({filteredAvailableTags.length})
                </button>
              </div>

              {/* 下拉選單列表 */}
              {isTagDropdownOpen && filteredAvailableTags.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsTagDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 transition-all">
                    {filteredAvailableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-light/40 dark:hover:bg-gray-755 transition-colors font-medium"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 已選擇的標籤 */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-100 dark:border-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-full p-0.5 transition-colors text-blue-500 dark:text-blue-455"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
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

          {/* 角色 (多選與動態載入) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">角色 (選填)</label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex flex-1 relative">
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => {
                      setRoleInput(e.target.value);
                      setIsRoleDropdownOpen(true);
                    }}
                    onFocus={() => setIsRoleDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (roleInput.trim()) {
                          handleAddRole(roleInput.trim());
                        }
                      }
                    }}
                    placeholder="輸入新角色..."
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-xl pl-4 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {roleInput && (
                    <button
                      type="button"
                      onClick={() => setRoleInput('')}
                      className="absolute right-[88px] top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full z-10"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddRole(roleInput)}
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-r-xl font-bold text-sm transition-colors shrink-0"
                  >
                    ➕ 新增
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className="px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-500 dark:text-gray-300 rounded-xl transition-all flex items-center justify-center font-semibold text-xs shrink-0"
                >
                  選擇 ({filteredAvailableRoles.length})
                </button>
              </div>

              {/* 下拉選單列表 */}
              {isRoleDropdownOpen && filteredAvailableRoles.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsRoleDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 transition-all">
                    {filteredAvailableRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleAddRole(role)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-light/40 dark:hover:bg-gray-755 transition-colors font-medium"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 已選擇的角色 Pill Badges */}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {roles.map((role, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 bg-primary/10 dark:bg-primary-dark/20 text-primary-dark dark:text-primary-light px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(index)}
                      className="hover:bg-primary/20 dark:hover:bg-primary-dark/40 rounded-full p-0.5 transition-colors text-primary-dark dark:text-primary-light/80"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
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
        </form>

        {/* Footer 動作按鈕 */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 p-4 pb-safe flex gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] transition-colors">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-650 active:bg-gray-300 transition-colors"
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
    </div>
  );
}
