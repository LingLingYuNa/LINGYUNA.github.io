/**
 * 俏皮野獸派 (Neo-Brutalist Playful) 完整 Token 字典與樣式預設集
 * 遵循 Neo-Brutalist Playful Design System Specification & Hard Prompt 規範
 */

export const neoBrutalistColors = {
  primary: '#000000',
  secondary: '#FFFFFF',
  textMain: '#000000',
  textMuted: '#374151',
  accents: {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    yellow: '#FFE66D',
    teal: '#95E1D3',
    peach: '#F38181'
  }
};

// 絕對禁止項清單 (用於開發時的代碼靜態檢查)
export const FORBIDDEN_CLASSES = [
  'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full', 'rounded-md', 'rounded-sm',
  'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl',
  'bg-gradient-to-r', 'bg-gradient-to-b', 'bg-gradient-to-tr',
  'text-gray-300', 'text-gray-400', 'text-gray-500', 'bg-gray-50', 'bg-gray-100',
  'font-light', 'font-thin', 'backdrop-blur'
];

export const neoBrutalistStyles = {
  // 動態彈簧物理與過渡動畫 (Toy Spring Motion)
  toySpring: 'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',

  // 實體硬陰影 (Hard Cut Shadows)
  shadowSmall: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
  shadowMedium: 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
  shadowLarge: 'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
  shadowCoral: 'shadow-[6px_6px_0px_0px_rgba(255,107,107,1)]',
  shadowMint: 'shadow-[6px_6px_0px_0px_rgba(78,205,196,1)]',
  shadowYellow: 'shadow-[6px_6px_0px_0px_rgba(255,230,109,1)]',

  // 卡片與容器
  card: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
  cardTiltedLeft: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-1.5deg] hover:rotate-[1.5deg] p-4 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
  cardTiltedRight: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[1.5deg] hover:rotate-[-1.5deg] p-4 md:p-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',

  // 經典按鈕 (帶 Joyful Press 按壓感與 Toy Spring 回彈)
  buttonCoral: 'bg-[#FF6B6B] text-white font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer inline-flex items-center justify-center gap-2',
  buttonYellow: 'bg-[#FFE66D] text-black font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer inline-flex items-center justify-center gap-2',
  buttonMint: 'bg-[#4ECDC4] text-black font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer inline-flex items-center justify-center gap-2',
  buttonDark: 'bg-black text-white font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[6px_6px_0px_0px_rgba(255,107,107,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer inline-flex items-center justify-center gap-2',

  // 表單輸入框
  input: 'w-full bg-white text-black font-mono font-bold border-4 border-black rounded-none px-4 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)] transition-all duration-200 placeholder:text-gray-500',

  // 標籤 (Badges)
  badgeCoral: 'bg-[#FF6B6B] text-white font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeMint: 'bg-[#4ECDC4] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeYellow: 'bg-[#FFE66D] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeTeal: 'bg-[#95E1D3] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',

  // 排版與字體
  heading: 'font-black text-black uppercase tracking-wider',
  bodyMono: 'font-mono text-sm md:text-base text-gray-700',

  // 布局與間距
  sectionPadding: 'py-12 md:py-20 lg:py-28',
  containerPadding: 'px-4 md:px-8 lg:px-12',
  gridGap: 'gap-4 md:gap-6'
};

export default neoBrutalistStyles;
