import React from 'react';
import { Home, List, Calculator, Wrench, Package } from 'lucide-react';

export default function Sidebar({ currentTab, onTabChange }) {
  const menuItems = [
    { id: 'home', name: '總覽頁面', icon: Home },
    { id: 'list', name: '資產清單', icon: List },
    { id: 'scissors', name: '🧮 計算機', icon: Calculator },
    { id: 'wrench', name: '系統工具', icon: Wrench },
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-colors duration-200 z-30">
      {/* LOGO 區 */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-md shadow-primary/20">
          <Package size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-bold text-gray-950 dark:text-white tracking-wide text-base leading-tight">CollectTrack</h1>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">混合式資產管理系統</span>
        </div>
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                isActive
                  ? 'bg-primary/10 text-primary-dark dark:text-primary-light'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 hover:text-gray-950 dark:hover:text-white'
              }`}
            >
              <Icon
                size={20}
                className={`transition-colors duration-200 ${
                  isActive
                    ? 'text-primary-dark dark:text-primary-light'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-950 dark:group-hover:text-white'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* 底部資訊 */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
        <p className="text-center font-medium">v1.1.0 • 本地加密儲存</p>
      </div>
    </aside>
  );
}
