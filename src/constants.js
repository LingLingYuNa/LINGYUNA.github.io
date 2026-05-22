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
  '已喊單': '#3B82F6',
  '已匯款/下單': '#F59E0B',
  '已到貨': '#9D4EDD',
  '已到手/完成': '#10B981',
  '已完成': '#10B981',
  '異常/缺件': '#EF4444'
};

export const ORDER_STATUSES = [
  { value: '已喊單', label: '已喊單', dot: '🔵', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: '已匯款/下單', label: '已匯款/下單', dot: '🟠', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { value: '已到貨', label: '已到貨', dot: '🟣', color: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 font-bold ring-2 ring-purple-400 shadow-md animate-pulse' },
  { value: '已完成', label: '已完成', dot: '🟢', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: '異常/缺件', label: '異常/缺件', dot: '🔴', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' }
];

export const getStatusStyle = (status) => {
  let matched = ORDER_STATUSES.find(s => s.value === status);
  if (!matched) {
    if (status === '已到手/完成') {
      matched = ORDER_STATUSES.find(s => s.value === '已完成');
    }
  }
  return matched || { label: status || '未知', dot: '⚪', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
};

export const PAYMENT_METHODS = ['現金', '信用卡', 'ATM/轉帳', '電子支付', '貨到付款'];

export const PAYMENT_METHOD_ICONS = {
  '現金': '💵',
  '信用卡': '💳',
  'ATM/轉帳': '🏦',
  '電子支付': '📱',
  '貨到付款': '📦'
};

