import React from 'react';
import { Home, List, Calculator, Wrench, Plus } from 'lucide-react';

export default function BottomNav({ currentTab, onTabChange, onAddClick }) {
  const getBtnClass = (tabId) => {
    const isActive = currentTab === tabId;
    return `flex flex-col items-center justify-center w-full h-full transition-all border-x-2 border-transparent ${
      isActive 
        ? 'bg-[#FFE66D] text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
        : 'text-black dark:text-white hover:bg-[#4ECDC4]/20'
    }`;
  };

  const getIconProps = (tabId) => ({
    size: 22,
    strokeWidth: currentTab === tabId ? 2.5 : 2
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-900 border-t-4 border-black dark:border-white shadow-[0_-4px_0px_0px_rgba(0,0,0,1)] z-50 transition-colors md:hidden">
      <div className="flex justify-around items-center h-16 relative px-1">
        {/* 總覽按鈕 */}
        <button onClick={() => onTabChange('home')} className={getBtnClass('home')}>
          <Home {...getIconProps('home')} />
          <span className="text-[10px] font-black uppercase mt-0.5">總覽</span>
        </button>
        
        {/* 清單按鈕 */}
        <button onClick={() => onTabChange('list')} className={getBtnClass('list')}>
          <List {...getIconProps('list')} />
          <span className="text-[10px] font-black uppercase mt-0.5">清單</span>
        </button>

        {/* 新增按鈕 (➕) - 正中間野獸派突出設計 */}
        <div className="flex items-center justify-center w-full h-full relative">
          <button 
            type="button"
            onClick={onAddClick}
            className="absolute -top-5 w-12 h-12 bg-[#FF6B6B] text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center justify-center transition-all duration-150 z-10 cursor-pointer"
            title="新增記帳/訂單"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
          <span className="text-[9px] text-black dark:text-white font-black uppercase absolute bottom-1 pointer-events-none">新增</span>
        </div>
        
        {/* 拆團小助手按鈕 */}
        <button onClick={() => onTabChange('scissors')} className={getBtnClass('scissors')}>
          <Calculator {...getIconProps('scissors')} />
          <span className="text-[10px] font-black uppercase mt-0.5">拆團</span>
        </button>
        
        {/* 工具按鈕 */}
        <button onClick={() => onTabChange('wrench')} className={getBtnClass('wrench')}>
          <Wrench {...getIconProps('wrench')} />
          <span className="text-[10px] font-black uppercase mt-0.5">工具</span>
        </button>
      </div>
    </div>
  );
}
