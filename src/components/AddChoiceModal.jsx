import React from 'react';
import { X, ShoppingBag, PackagePlus } from 'lucide-react';

export default function AddChoiceModal({ onClose, onSelectChoice }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 transition-all">
      <div className="bg-white dark:bg-gray-900 w-full md:max-w-md rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black overflow-hidden flex flex-col transition-colors animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b-4 border-black flex items-center justify-between bg-[#FFE66D] text-black">
          <h3 className="font-black text-black text-base uppercase tracking-wider">請選擇新增類型</h3>
          <button 
            onClick={onClose}
            className="p-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* 選擇列表 */}
        <div className="p-5 space-y-3.5 bg-[#f7f1df] dark:bg-gray-800">
          
          {/* 1. 新增訂單 */}
          <button
            type="button"
            onClick={() => onSelectChoice('order')}
            className="w-full p-4 bg-[#FF6B6B] text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none text-left transition-all flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-none bg-black text-white flex items-center justify-center shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <ShoppingBag size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-black text-sm uppercase tracking-wider flex items-center gap-2">
                <span>新增週邊/購物訂單</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#FFE66D] text-black font-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">推薦</span>
              </div>
              <p className="text-xs font-mono font-bold text-black/80 mt-1">
                紀錄整筆代購或喊單，含幣別、匯率、國際運費與滿減折扣
              </p>
            </div>
          </button>

          {/* 2. 單獨新增物品 */}
          <button
            type="button"
            onClick={() => onSelectChoice('item')}
            className="w-full p-4 bg-[#4ECDC4] text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none text-left transition-all flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-none bg-black text-white flex items-center justify-center shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <PackagePlus size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-black text-sm uppercase tracking-wider">
                單獨新增物品 (先記下，之後再歸屬)
              </div>
              <p className="text-xs font-mono font-bold text-black/80 mt-1">
                獨立登記單一戰利品或週邊，隨時可一鍵併入指定訂單中
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
