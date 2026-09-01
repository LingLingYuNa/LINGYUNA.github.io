import React from 'react';
import { Home, List, Calculator, Wrench, Package } from 'lucide-react';

export default function Sidebar({ currentTab, onTabChange }) {
  const menuItems = [
    { id: 'home', name: '總覽頁面', icon: Home },
    { id: 'list', name: '資產清單', icon: List },
    { id: 'scissors', name: '揪拆團小助手', icon: Calculator },
    { id: 'wrench', name: '系統工具', icon: Wrench },
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-white dark:bg-gray-900 border-r-4 border-black dark:border-white transition-colors duration-200 z-30">
      {/* LOGO 區：俏皮野獸派大膽塊面與硬陰影 */}
      <div className="px-5 py-5 border-b-4 border-black dark:border-white shrink-0 bg-[#FFE66D] dark:bg-gray-800">
        <div className="flex items-center gap-3 bg-[#FF6B6B] text-black p-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[-1.5deg]">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center border-2 border-black shrink-0">
            <Package size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-black uppercase tracking-wider text-base leading-tight truncate">CollectTrack</h1>
            <span className="text-[10px] text-black font-extrabold uppercase block">資產管理系統</span>
          </div>
        </div>
      </div>

      {/* 導覽選單 */}
      <nav className="flex-1 px-4 py-6 space-y-2.5 overflow-y-auto">
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const bgColors = ['bg-[#FF6B6B]', 'bg-[#4ECDC4]', 'bg-[#FFE66D]', 'bg-[#95E1D3]'];
          const colorClass = bgColors[idx % bgColors.length];

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-black border-4 border-black transition-all duration-200 group cursor-pointer ${
                isActive
                  ? `${colorClass} text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[2px] translate-y-[-2px]`
                  : 'bg-white dark:bg-gray-800 text-black dark:text-white hover:bg-[#4ECDC4]/20 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <Icon
                size={20}
                className="text-black dark:text-white stroke-[2.5]"
              />
              <span className="uppercase tracking-wider">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* 底部資訊 */}
      <div className="p-4 border-t-4 border-black dark:border-white text-xs font-mono font-bold bg-[#4ECDC4] text-black shrink-0">
        <p className="text-center">v1.1.0 • 本地加密儲存</p>
      </div>
    </aside>
  );
}
