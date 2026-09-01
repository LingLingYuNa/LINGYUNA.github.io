import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Image as ImageIcon, Camera } from 'lucide-react';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { db } from '../db';
import { DEFAULT_TAGS } from '../constants';
import { compressImage, calculateOrderTotalTWD, getItemIps } from '../utils';

export default function AddItem({ orderId, existingItem, onClose }) {
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const [assignedOrderId, setAssignedOrderId] = useState(
    existingItem?.order_id ?? (orderId || null)
  );
  const availableOrders = useLiveQuery(() => db.orders.orderBy('created_at').reverse().toArray(), []) || [];
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

  // IP (作品) 改為多選標籤模式，向下相容舊資料欄位 ip 與 ips
  const [ips, setIps] = useState(
    existingItem?.ips || (existingItem?.ip ? existingItem.ip.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [])
  );
  const [sourceType, setSourceType] = useState(existingItem?.source_type || 'official');
  const [fanSource, setFanSource] = useState(existingItem?.fan_source || '');

  // 屬性設定彈跳視窗狀態與臨時狀態
  const [isPropModalOpen, setIsPropModalOpen] = useState(false);
  const [tempIps, setTempIps] = useState([]);
  const [tempIpInput, setTempIpInput] = useState('');
  const [tempRoles, setTempRoles] = useState([]);
  const [tempTags, setTempTags] = useState([]);
  const [tempSourceType, setTempSourceType] = useState('official');
  const [tempFanSource, setTempFanSource] = useState('');
  const [tempRoleInput, setTempRoleInput] = useState('');
  const [tempTagInput, setTempTagInput] = useState('');

  // IP 常用角色推薦對應表 states
  const DEFAULT_IP_ROLES = {
    '原神': ['鍾離', '胡桃', '魈', '×××'],
    '崩壞•星穹鐵道': ['卡芙卡', '流螢', '黃泉', '000']
  };

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

  const [isEditingIpRoles, setIsEditingIpRoles] = useState(false);
  const [editTargetIp, setEditTargetIp] = useState('原神');
  const [editRolesInput, setEditRolesInput] = useState('');

  // 手機硬體返回鍵綁定
  const handleClosePropModal = useHardwareBack(isPropModalOpen, () => setIsPropModalOpen(false), 'prop-modal');
  const handleCloseEditIpRoles = useHardwareBack(isEditingIpRoles, () => setIsEditingIpRoles(false), 'edit-ip-roles');

  const handleOpenEditIpRoles = () => {
    const target = tempIps[0] || '原神';
    setEditTargetIp(target);
    setEditRolesInput((ipRolesMap[target] || []).join(', '));
    setIsEditingIpRoles(true);
  };

  const handleSaveIpRoles = () => {
    const trimmedIp = editTargetIp.trim();
    if (!trimmedIp) return;
    
    const parsedRoles = editRolesInput
      .split(/[,，\s]+/)
      .map(r => r.trim())
      .filter(Boolean);
      
    const newMap = {
      ...ipRolesMap,
      [trimmedIp]: parsedRoles
    };
    
    setIpRolesMap(newMap);
    localStorage.setItem('collecttrack_ip_roles_map', JSON.stringify(newMap));
    handleCloseEditIpRoles();
  };

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
      const itemIps = getItemIps(item);
      itemIps.forEach(i => i && ipsSet.add(i.trim()));
    });
    return Array.from(ipsSet).filter(Boolean);
  }, [dbItems]);

  // 提取所有已存在的同人來源作為選項
  const availableFanSources = React.useMemo(() => {
    const sourcesSet = new Set([
      '繪師/社團自製',
      '同人委託',
      '微博/小紅書拼團',
      '淘寶同人店',
      '日本同人(Booth/Mercari)'
    ]);
    
    dbItems.forEach(item => {
      if (item.fan_source) {
        sourcesSet.add(item.fan_source.trim());
      }
    });
    
    return Array.from(sourcesSet).filter(Boolean);
  }, [dbItems]);

  // 基於 temp 狀態計算過濾後的角色推薦
  const filteredAvailableRoles = React.useMemo(() => {
    return availableRoles.filter(role => 
      !tempRoles.includes(role) && 
      role.toLowerCase().includes(tempRoleInput.toLowerCase())
    );
  }, [availableRoles, tempRoles, tempRoleInput]);

  // 基於當前選擇的 tempIps 列表與對應表，計算推薦角色
  const ipRecommendedRoles = React.useMemo(() => {
    if (tempIps.length === 0) return [];
    const recommendedSet = new Set();
    tempIps.forEach(ipName => {
      const list = ipRolesMap[ipName] || [];
      list.forEach(r => recommendedSet.add(r));
    });
    return Array.from(recommendedSet).filter(role => 
      !tempRoles.includes(role) && 
      role.toLowerCase().includes(tempRoleInput.toLowerCase())
    );
  }, [tempIps, ipRolesMap, tempRoles, tempRoleInput]);

  // 屬性設定彈跳視窗操作方法
  const handleOpenPropModal = () => {
    setTempIps([...ips]);
    setTempIpInput('');
    setTempRoles([...roles]);
    setTempTags([...selectedTags]);
    setTempSourceType(sourceType);
    setTempFanSource(fanSource);
    setTempRoleInput('');
    setTempTagInput('');
    setIsPropModalOpen(true);
  };

  const handleConfirmProps = () => {
    setIps(tempIps);
    setRoles(tempRoles);
    setSelectedTags(tempTags);
    setSourceType(tempSourceType);
    setFanSource(tempFanSource);
    handleClosePropModal();
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
      const targetOrderId = assignedOrderId ? Number(assignedOrderId) : null;
      const oldOrderId = existingItem?.order_id ? Number(existingItem.order_id) : null;

      const itemData = {
        order_id: targetOrderId,
        name,
        ip: ips.join(', '),
        ips: ips,
        roles: roles,
        character: roles.join(', '),
        tags: selectedTags,
        quantity: Number(quantity),
        price: Number(price),
        weight: Number(weight) || 0,
        image: images[0] || '',
        images: images,
        source_type: sourceType,
        fan_source: fanSource,
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

      // 輔助函數：連動更新指定訂單金額
      const updateOrderTotal = async (targetId) => {
        if (!targetId) return;
        const parentOrder = await db.orders.get(targetId);
        if (!parentOrder) return;
        
        const allItems = await db.items.where({ order_id: targetId }).toArray();
        const newTotal = allItems.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
        const updatedOrder = {
          ...parentOrder,
          total_amount: newTotal
        };
        const newTotalTWD = calculateOrderTotalTWD(updatedOrder, allItems);
        await db.orders.update(targetId, { 
          total_amount: newTotal,
          total_amount_twd: newTotalTWD
        });
      };

      // 若舊訂單存在且與新訂單不同，重新計算舊訂單
      if (oldOrderId && oldOrderId !== targetOrderId) {
        await updateOrderTotal(oldOrderId);
      }

      // 重新計算新訂單
      if (targetOrderId) {
        await updateOrderTotal(targetOrderId);
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
      className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900 md:bg-gray-950/60 md:backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-gray-900 w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-none md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col border border-transparent dark:border-gray-800 animate-in slide-in-from-bottom-8 duration-300">
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
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 訂單歸屬 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">訂單歸屬 (選填)</label>
              <span className="text-[11px] text-gray-400 font-normal">可先單獨登記，之後再併入訂單</span>
            </div>
            <select
              value={assignedOrderId || ''}
              onChange={(e) => setAssignedOrderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100"
            >
              <option value="">暫不歸屬 (單獨登記物品)</option>
              {availableOrders.map(ord => (
                <option key={ord.id} value={ord.id}>
                  {ord.title || ord.source || '未命名訂單'} ({ord.created_at ? ord.created_at.split('T')[0] : ''})
                </option>
              ))}
            </select>
          </div>

          {/* 週邊屬性卡片 */}
          <div className="bg-gray-150/50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/60 rounded-none p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                週邊屬性設定
              </span>
              <button
                type="button"
                onClick={handleOpenPropModal}
                className="text-xs font-bold text-primary hover:text-primary-dark transition-colors px-2.5 py-1.5 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-none hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {(ips.length > 0 || roles.length > 0 || selectedTags.length > 0) ? '編輯屬性' : '設定屬性'}
              </button>
            </div>
            
            {/* 已選屬性展示 */}
            {(ips.length > 0 || roles.length > 0 || selectedTags.length > 0 || sourceType) ? (
              <div className="space-y-2.5">
                {/* 來源屬性 */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0">來源：</span>
                  <span className={`px-2.5 py-0.5 rounded-none font-bold border text-[10px] ${
                    sourceType === 'official'
                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-100/50 dark:border-amber-900/50'
                      : 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-100/50 dark:border-purple-900/50'
                  }`}>
                    {sourceType === 'official' ? '官方周邊' : `同人周邊 (${fanSource || '未註明來源'})`}
                  </span>
                </div>

                {/* 作品 (IP) */}
                {ips.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0 mt-1">作品：</span>
                    <div className="flex flex-wrap gap-1">
                      {ips.map((ipName, idx) => (
                        <span key={idx} className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-none font-bold border border-purple-100/50 dark:border-purple-900/50">
                          {ipName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 角色 */}
                {roles.length > 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 dark:text-gray-555 font-medium w-10 shrink-0 mt-1">角色：</span>
                    <div className="flex flex-wrap gap-1">
                      {roles.map((role, idx) => (
                        <span key={idx} className="bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-none font-bold border border-pink-100/50 dark:border-pink-900/50">
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
                        <span key={tag} className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-none font-bold border border-blue-100/50 dark:border-blue-900/50">
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
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100"
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
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                    className="w-20 h-20 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all group"
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
                <div className="w-20 h-20 rounded-none border border-dashed border-gray-300 dark:border-gray-750 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center shrink-0">
                  <ImageIcon className="text-gray-400 dark:text-gray-655" size={24} />
                  <span className="text-[10px] text-gray-400 dark:text-gray-550 mt-1">無照片</span>
                </div>
              )}
            </div>

            {/* 上傳與輸入區塊 */}
            <div className="space-y-3">
              {/* 檔案上傳按鈕 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">新增圖片方式：</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-xs font-bold active:scale-95 transition-all"
                  >
                    <Camera size={14} className="text-primary-dark dark:text-primary" />
                    <span>拍攝照片</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => albumInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-xs font-bold active:scale-95 transition-all"
                  >
                    <ImageIcon size={14} className="text-primary-dark dark:text-primary" />
                    <span>選擇相簿</span>
                  </button>
                </div>
                
                {/* 隱藏的相機拍照 input */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                
                {/* 隱藏的相簿多選 input */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={albumInputRef}
                  onChange={handleImageChange}
                  className="hidden"
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
                      placeholder="貼上圖片網址 (Image URL)..."
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none pl-3 pr-8 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                    className="px-4 bg-primary hover:bg-primary-dark text-white rounded-none font-bold text-xs transition-colors shrink-0"
                  >
                    加入
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
            className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-705 text-gray-700 dark:text-gray-200 rounded-none font-semibold hover:bg-gray-200 dark:hover:bg-gray-650 active:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !name || !price}
            className="flex-1 py-3.5 px-4 bg-primary text-white rounded-none font-semibold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-primary/30 hover:bg-primary-dark active:bg-primary-dark transition-colors disabled:opacity-50 disabled:shadow-none"
          >
            {isSaving ? '儲存中...' : (existingItem ? '儲存變更' : '儲存')}
          </button>
        </div>
      </div>

      {/* 三合一屬性設定彈跳視窗 */}
      {isPropModalOpen && (
        <div 
          className="fixed inset-0 z-[70] bg-gray-950/40 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6"
        >
          <div className="bg-white dark:bg-gray-900 w-full h-[85vh] md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-200">
            
            {/* 標題列 */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80 shrink-0">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                屬性設定 (IP/角色/製品)
              </h3>
              <button 
                type="button" 
                onClick={handleClosePropModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 內容滾動區 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* 1. 作品 (IP) 選擇區 (可多選) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                    1. 作品 (IP) (可多選)
                  </h4>
                  <button
                    type="button"
                    onClick={handleOpenEditIpRoles}
                    className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-none"
                  >
                    編輯推薦角色
                  </button>
                </div>

                {/* 已選 IP 標籤清單 */}
                {tempIps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-purple-50/50 dark:bg-purple-950/20 rounded-none border border-purple-100 dark:border-purple-900/40">
                    {tempIps.map((ipName) => (
                      <span 
                        key={ipName} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      >
                        {ipName}
                        <button
                          type="button"
                          onClick={() => setTempIps(tempIps.filter(i => i !== ipName))}
                          className="hover:text-purple-950 dark:hover:text-white rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 常用 IP 快速勾選按鈕 */}
                {availableIPs.length > 0 && (
                  <div className="flex gap-2 flex-wrap pb-1">
                    {availableIPs.map((option) => {
                      const isSelected = tempIps.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setTempIps(tempIps.filter(i => i !== option));
                            } else {
                              setTempIps([...tempIps, option]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-550 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-750'
                          }`}
                        >
                          {isSelected ? `✓ ${option}` : `+ ${option}`}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 輸入自訂 IP */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tempIpInput.trim() && !tempIps.includes(tempIpInput.trim())) {
                      setTempIps([...tempIps, tempIpInput.trim()]);
                      setTempIpInput('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={tempIpInput}
                      onChange={(e) => setTempIpInput(e.target.value)}
                      placeholder="輸入自訂作品名稱按下 Enter 或點擊新增..."
                      className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-none px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                    {tempIpInput && (
                      <button
                        type="button"
                        onClick={() => setTempIpInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempIpInput.trim() && !tempIps.includes(tempIpInput.trim())) {
                        setTempIps([...tempIps, tempIpInput.trim()]);
                        setTempIpInput('');
                      }
                    }}
                    className="px-3.5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-none font-bold text-xs shrink-0 transition-colors"
                  >
                    新增
                  </button>
                </form>
              </div>

              {/* 2. 角色選擇區 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                    2. 角色選擇 (可多選)
                  </h4>
                  <button
                    type="button"
                    onClick={handleOpenEditIpRoles}
                    className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-none"
                  >
                    編輯常用推薦
                  </button>
                </div>

                {/* 常用推薦角色 Pills */}
                {tempIps.length > 0 && (
                  <div className="space-y-1 bg-pink-50/20 dark:bg-pink-950/5 p-2.5 rounded-none border border-pink-100/40 dark:border-pink-950/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-pink-500 dark:text-pink-400 font-bold">{tempIps.join(' / ')} 常用角色推薦：</span>
                      <button
                        type="button"
                        onClick={handleOpenEditIpRoles}
                        className="text-[10px] font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors flex items-center gap-0.5"
                      >
                        編輯此 IP 推薦
                      </button>
                    </div>
                    {ipRecommendedRoles.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap pt-1.5 pb-1">
                        {ipRecommendedRoles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleAddTempRole(role)}
                            className="px-2.5 py-1 rounded-none text-xs font-semibold bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/40 border border-pink-100/50 dark:border-pink-900/50 transition-all"
                          >
                            + {role}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 dark:text-gray-550 italic pt-1 pb-1">
                        無剩餘推薦角色。
                      </p>
                    )}
                  </div>
                )}

                {/* 全域已用角色推薦 Pills */}
                {filteredAvailableRoles.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 font-semibold">歷史使用角色：</span>
                    <div className="flex gap-1.5 flex-wrap max-h-24 overflow-y-auto pb-1 scrollbar-none">
                      {filteredAvailableRoles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleAddTempRole(role)}
                          className="px-2.5 py-1 rounded-none text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 border border-transparent transition-all"
                        >
                          + {role}
                        </button>
                      ))}
                    </div>
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
                    新增
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
                        className="px-2.5 py-1.5 rounded-none text-xs font-bold bg-gray-55 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850 border border-transparent transition-all"
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
                    新增
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

              {/* 4. 來源與同人出處區 */}
              <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-850">
                <h4 className="text-xs font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">
                  4. 來源屬性
                </h4>
                
                {/* 官方/同人分段選擇 */}
                <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-none transition-colors">
                  <button
                    type="button"
                    onClick={() => {
                      setTempSourceType('official');
                      setTempFanSource(''); // 切回官方時清空同人來源
                    }}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-none transition-all ${
                      tempSourceType === 'official'
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-gray-200/20'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    官方周邊
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempSourceType('fan')}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-none transition-all ${
                      tempSourceType === 'fan'
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-gray-200/20'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    同人自製/二創
                  </button>
                </div>

                {/* 如果是同人，展開來源選擇與輸入 */}
                {tempSourceType === 'fan' && (
                  <div className="space-y-3 bg-purple-50/20 dark:bg-purple-950/5 p-3 rounded-none border border-purple-100/40 dark:border-purple-950/20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="text-[10px] text-purple-650 dark:text-purple-400 font-bold block mb-1">同人來源/作者/社團：</span>
                    
                    {/* 推薦來源 Pills */}
                    {availableFanSources.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pb-1">
                        {availableFanSources.map((source) => (
                          <button
                            key={source}
                            type="button"
                            onClick={() => setTempFanSource(source)}
                            className={`px-2.5 py-1 rounded-none text-[10px] font-bold transition-all border ${
                              tempFanSource === source
                                ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-850 dark:text-purple-300 border-purple-200 dark:border-purple-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-white dark:bg-gray-800 text-gray-550 dark:text-gray-400 border-transparent hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                          >
                            {source}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 自訂輸入框 */}
                    <div className="relative">
                      <input
                        type="text"
                        value={tempFanSource}
                        onChange={(e) => setTempFanSource(e.target.value)}
                        placeholder="請輸入或選擇繪師、社團或同人來源名稱..."
                        className="w-full bg-white dark:bg-gray-800 border border-gray-250 dark:border-gray-750 rounded-none px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                      {tempFanSource && (
                        <button
                          type="button"
                          onClick={() => setTempFanSource('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* 底部確定/取消動作欄 */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-850 p-4 pb-safe flex gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
              <button
                type="button"
                onClick={handleClosePropModal}
                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-255 rounded-none font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 transition-colors text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmProps}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-none font-semibold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-primary/30 hover:bg-primary-dark active:bg-primary-dark transition-colors text-xs"
              >
                確認設定
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 編輯 IP 常用角色推薦彈窗 */}
      {isEditingIpRoles && (
        <div 
          className="fixed inset-0 z-[80] bg-gray-950/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 w-full h-auto max-h-[70vh] md:w-full md:max-w-md md:rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 p-5 space-y-4 border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-2">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                編輯 IP 推薦角色
              </h3>
              <button 
                type="button" 
                onClick={handleCloseEditIpRoles}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-850"
              >
                <X size={16} />
              </button>
            </div>

            {/* IP 名稱設定 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-450">作品名稱 (IP)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTargetIp}
                  onChange={(e) => setEditTargetIp(e.target.value)}
                  placeholder="例如：原神"
                  className="flex-1 bg-gray-55 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-none px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                
                {/* 快速切換現有 IP */}
                <select
                  value={editTargetIp}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setEditTargetIp(selected);
                    setEditRolesInput((ipRolesMap[selected] || []).join(', '));
                  }}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-250 dark:border-gray-750 rounded-none px-2 py-2 text-xs focus:outline-none text-gray-800 dark:text-gray-150"
                >
                  <option value="" disabled>快速載入現有 IP...</option>
                  {Object.keys(ipRolesMap).map(ipKey => (
                    <option key={ipKey} value={ipKey}>{ipKey}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 角色名單編輯 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-450">
                常用角色名單 (以逗號、中文逗號或空格分隔)
              </label>
              <textarea
                value={editRolesInput}
                onChange={(e) => setEditRolesInput(e.target.value)}
                placeholder="例如：鍾離, 胡桃, 魈, ×××"
                rows={4}
                className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-none px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-550 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseEditIpRoles}
                className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-none font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveIpRoles}
                className="flex-1 py-2.5 px-4 bg-primary text-white rounded-none font-semibold hover:bg-primary-dark transition-colors text-xs"
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
