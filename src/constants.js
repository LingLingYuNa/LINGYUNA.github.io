// 舊版匯率，保留相容性
export const EXCHANGE_RATES = {
  RMB: 5.5,
  JPY: 0.23
};

export const CURRENCIES = [
  { code: 'RMB', symbol: '¥', label: '人民幣', defaultRate: 5.5 },
  { code: 'JPY', symbol: '¥', label: '日幣', defaultRate: 0.23 },
  { code: 'TWD', symbol: 'NT$', label: '台幣', defaultRate: 1 }
];

export const DEFAULT_TAGS = [
  '立牌', 
  '徽章', 
  '色紙', 
  '拍立得', 
  '黏土人', 
  '比例模型'
];

export const STATUS_COLORS = {
  '已喊單': '#95E1D3',
  '已匯款/下單': '#FFE66D',
  '已到貨': '#FF6B6B',
  '已到手/完成': '#4ECDC4',
  '已完成': '#4ECDC4',
  '異常/缺件': '#F38181'
};

export const ORDER_STATUSES = [
  { value: '已喊單', label: '已喊單', dot: '', color: 'bg-[#95E1D3] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none' },
  { value: '已匯款/下單', label: '已匯款/下單', dot: '', color: 'bg-[#FFE66D] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none' },
  { value: '已到貨', label: '已到貨', dot: '', color: 'bg-[#FF6B6B] text-white border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none animate-bounce' },
  { value: '已完成', label: '已完成', dot: '', color: 'bg-[#4ECDC4] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none' },
  { value: '異常/缺件', label: '異常/缺件', dot: '', color: 'bg-[#F38181] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none' }
];

export const getStatusStyle = (status) => {
  let matched = ORDER_STATUSES.find(s => s.value === status);
  if (!matched) {
    if (status === '已到手/完成') {
      matched = ORDER_STATUSES.find(s => s.value === '已完成');
    }
  }
  return matched || { label: status || '未知', dot: '', color: 'bg-white text-black border-2 border-black font-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' };
};

export const PAYMENT_METHODS = ['現金', '信用卡', 'ATM/轉帳', '電子支付', '貨到付款'];

export const PAYMENT_METHOD_ICONS = {
  '現金': '$',
  '信用卡': 'CR',
  'ATM/轉帳': 'ATM',
  '電子支付': 'PAY',
  '貨到付款': 'COD'
};
