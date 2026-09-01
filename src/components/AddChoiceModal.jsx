import React from 'react';
import { X, ShoppingBag, PackagePlus, Zap } from 'lucide-react';

export default function AddChoiceModal({ onClose, onSelectChoice }) {
  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-all"
    >
      <div className="bg-white dark:bg-gray-900 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col transition-colors animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">請選擇新增類型</h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 選擇列表 */}
        <div className="p-4 md:p-6 space-y-3">
          
          {/* 1. 新增訂單 */}
          <button
            type="button"
            onClick={() => onSelectChoice('order')}
            className="w-full p-4 rounded-2xl border border-primary-light/60 dark:border-primary-dark/40 bg-primary-light/20 dark:bg-primary-dark/10 hover:bg-primary-light/40 dark:hover:bg-primary-dark/20 text-left transition-all flex items-center gap-4 group active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/30 group-hover:scale-105 transition-transform">
              <ShoppingBag size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-1.5">
                <span>新增週邊/購物訂單</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary-dark dark:text-primary font-bold">推薦</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                紀錄整筆代購或喊單，含幣別、匯率、國際運費與滿減折扣
              </p>
            </div>
          </button>

          {/* 2. 單獨新增物品 */}
          <button
            type="button"
            onClick={() => onSelectChoice('item')}
            className="w-full p-4 rounded-2xl border border-secondary-light/80 dark:border-secondary-dark/40 bg-secondary-light/20 dark:bg-secondary-dark/10 hover:bg-secondary-light/40 dark:hover:bg-secondary-dark/20 text-left transition-all flex items-center gap-4 group active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary-dark text-white flex items-center justify-center shrink-0 shadow-md shadow-secondary-dark/30 group-hover:scale-105 transition-transform">
              <PackagePlus size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                單獨新增物品 (先記下，之後再歸屬)
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                獨立登記單一戰利品或週邊，隨時可一鍵併入指定訂單中
              </p>
            </div>
          </button>

          {/* 3. 快速生活記帳 */}
          <button
            type="button"
            onClick={() => onSelectChoice('quick')}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-all flex items-center gap-4 group active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-700 dark:bg-gray-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Zap size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                極簡生活記帳
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                快速輸入日常花費金額與類別標籤（如：餐飲、交通、日用）
              </p>
            </div>
          </button>

        </div>

      </div>
    </div>
  );
}
