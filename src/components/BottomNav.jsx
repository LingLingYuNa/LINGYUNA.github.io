import React from 'react';
import { Home, List, Scissors, Wrench } from 'lucide-react';

export default function BottomNav({ currentTab, onTabChange }) {
  // 輔助函式：判斷按鈕是否為目前選取狀態，給予對應的樣式
  const getBtnClass = (tabId) => {
    const isActive = currentTab === tabId;
    return `flex flex-col items-center justify-center w-full h-full transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 active:bg-gray-100 dark:active:bg-gray-800 ${
      isActive ? 'text-primary-dark dark:text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-primary-dark dark:hover:text-primary'
    }`;
  };

  const getIconProps = (tabId) => ({
    size: 24,
    strokeWidth: currentTab === tabId ? 2.5 : 2
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 transition-colors md:hidden">
      <div className="flex justify-around items-center h-16">
        {/* 總覽按鈕 */}
        <button onClick={() => onTabChange('home')} className={getBtnClass('home')}>
          <Home {...getIconProps('home')} />
          <span className={`text-[10px] mt-1 ${currentTab === 'home' ? 'font-semibold' : 'font-medium'}`}>總覽</span>
        </button>
        
        {/* 清單按鈕 */}
        <button onClick={() => onTabChange('list')} className={getBtnClass('list')}>
          <List {...getIconProps('list')} />
          <span className={`text-[10px] mt-1 ${currentTab === 'list' ? 'font-semibold' : 'font-medium'}`}>清單</span>
        </button>
        
        {/* 拆單按鈕 */}
        <button onClick={() => onTabChange('scissors')} className={getBtnClass('scissors')}>
          <Scissors {...getIconProps('scissors')} />
          <span className={`text-[10px] mt-1 ${currentTab === 'scissors' ? 'font-semibold' : 'font-medium'}`}>拆單</span>
        </button>
        
        {/* 工具按鈕 */}
        <button onClick={() => onTabChange('wrench')} className={getBtnClass('wrench')}>
          <Wrench {...getIconProps('wrench')} />
          <span className={`text-[10px] mt-1 ${currentTab === 'wrench' ? 'font-semibold' : 'font-medium'}`}>工具</span>
        </button>
      </div>
    </div>
  );
}
