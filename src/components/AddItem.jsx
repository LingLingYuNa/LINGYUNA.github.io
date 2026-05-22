import React, { useState } from 'react';
import { X } from 'lucide-react';
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
  
  const [quantity, setQuantity] = useState(existingItem?.quantity || 1);
  const [price, setPrice] = useState(existingItem?.price || '');
  const [weight, setWeight] = useState(existingItem?.weight || '');
  const [selectedTag, setSelectedTag] = useState(existingItem?.tag || '');
  const [image, setImage] = useState(existingItem?.image || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddRole = (e) => {
    if (e) e.preventDefault();
    const trimmed = roleInput.trim();
    if (trimmed && !roles.includes(trimmed)) {
      setRoles([...roles, trimmed]);
      setRoleInput('');
    }
  };

  const handleRemoveRole = (indexToRemove) => {
    setRoles(roles.filter((_, idx) => idx !== indexToRemove));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setImage(compressed);
      } catch (error) {
        console.error('圖片壓縮失敗:', error);
      }
    }
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
        tag: selectedTag,
        quantity: Number(quantity),
        price: Number(price),
        weight: Number(weight) || 0,
        image,
      };

      if (existingItem) {
        await db.items.update(existingItem.id, itemData);
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

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 智慧分類標籤 (單選) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">分類標籤</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all border ${
                    selectedTag === tag 
                      ? 'bg-primary text-white border-primary shadow-sm' 
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-dark hover:bg-primary-light/30'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 照片上傳 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">照片 (選填)</label>
            <div className="flex items-center gap-4">
              {image && (
                <img src={image} alt="預覽" className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm shrink-0" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light/50 dark:file:bg-gray-700 file:text-primary-dark dark:file:text-gray-300 hover:file:bg-primary-light dark:hover:file:bg-gray-600 transition-colors w-full"
              />
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

          {/* 角色 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">角色 (選填)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddRole(e);
                  }
                }}
                placeholder="例如：五條悟、夏油傑..."
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={handleAddRole}
                className="px-4 bg-primary-light dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/10 dark:hover:bg-primary/10 text-primary-dark dark:text-primary-light text-sm font-medium rounded-xl transition-all shrink-0"
              >
                新增
              </button>
            </div>
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
