/**
 * 俏皮野獸派 (Neo-Brutalist Playful) Tailwind CSS 樣式預設集
 * 遵循 Neo-Brutalist Playful 設計規範
 */

export const neoBrutalistColors = {
  primary: '#000000',
  secondary: '#FFFFFF',
  accents: {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    yellow: '#FFE66D',
    teal: '#95E1D3',
    peach: '#F38181'
  }
};

export const neoBrutalistStyles = {
  // 卡片與容器
  card: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 transition-all duration-300',
  cardTiltedLeft: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-1.5deg] hover:rotate-0 p-4 md:p-6 transition-all duration-300',
  cardTiltedRight: 'bg-white text-black border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[1.5deg] hover:rotate-0 p-4 md:p-6 transition-all duration-300',
  
  // 按鈕
  buttonCoral: 'bg-[#FF6B6B] text-black font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 cursor-pointer inline-flex items-center justify-center gap-2',
  buttonYellow: 'bg-[#FFE66D] text-black font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 cursor-pointer inline-flex items-center justify-center gap-2',
  buttonMint: 'bg-[#4ECDC4] text-black font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 cursor-pointer inline-flex items-center justify-center gap-2',
  buttonDark: 'bg-black text-white font-black border-4 border-black rounded-none px-5 py-2.5 shadow-[4px_4px_0px_0px_rgba(255,107,107,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(255,107,107,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 cursor-pointer inline-flex items-center justify-center gap-2',

  // 表單輸入框
  input: 'w-full bg-white text-black font-bold border-4 border-black rounded-none px-4 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)] transition-all duration-150',

  // 標籤 (Badges)
  badgeCoral: 'bg-[#FF6B6B] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeMint: 'bg-[#4ECDC4] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeYellow: 'bg-[#FFE66D] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',
  badgeTeal: 'bg-[#95E1D3] text-black font-black border-2 border-black rounded-none px-2.5 py-0.5 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1',

  // 標題與字體
  heading: 'font-black text-black uppercase tracking-wider',
  
  // 布局與間距
  sectionPadding: 'py-12 md:py-20 lg:py-28',
  containerPadding: 'px-4 md:px-8 lg:px-12',
  gridGap: 'gap-4 md:gap-6'
};

export default neoBrutalistStyles;
