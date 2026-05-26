import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { EXCHANGE_RATES } from '../constants';

export default function SplitOrder() {
  const [foreignTotal, setForeignTotal] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [shippingNTD, setShippingNTD] = useState('');
  const [exchangeRate, setExchangeRate] = useState(EXCHANGE_RATES.RMB);

  const calculateCosts = () => {
    const totalQty = Number(quantity) || 1;
    const fTotal = Number(foreignTotal) || 0;
    const sNTD = Number(shippingNTD) || 0;
    const rate = Number(exchangeRate) || 1;

    // 計算總台幣成本 (外幣總額 * 匯率 + 境內外二補運費)
    const totalNTD = (fTotal * rate) + sNTD;
    
    // 計算單件真實成本
    const rawCostPerItem = totalNTD / totalQty;
    
    // 計算建議分攤價 (以 5 為級距，無條件進位)
    // 範例：142 / 5 = 28.4 -> ceil(28.4) = 29 -> 29 * 5 = 145
    // 範例：147 / 5 = 29.4 -> ceil(29.4) = 30 -> 30 * 5 = 150
    const suggestedPrice = Math.ceil(rawCostPerItem / 5) * 5;

    return { totalNTD, rawCostPerItem, suggestedPrice };
  };

  const { totalNTD, rawCostPerItem, suggestedPrice } = calculateCosts();

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32">
      {/* 標題區 */}
      <header className="px-1 mt-2 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">分攤計算機</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">快速試算盲盒或團購的單件合理建議價</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 參數輸入區塊 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/80 space-y-5 transition-colors">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">外幣總金額</label>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setExchangeRate(EXCHANGE_RATES.RMB)} 
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${Number(exchangeRate) === EXCHANGE_RATES.RMB ? 'bg-primary-light dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  RMB
                </button>
                <button 
                  type="button" 
                  onClick={() => setExchangeRate(EXCHANGE_RATES.JPY)} 
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${Number(exchangeRate) === EXCHANGE_RATES.JPY ? 'bg-primary-light dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  JPY
                </button>
                <button 
                  type="button" 
                  onClick={() => setExchangeRate(1.0)} 
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${Number(exchangeRate) === 1.0 ? 'bg-primary-light dark:bg-primary-dark/30 text-primary-dark dark:text-primary-light' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  TWD
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={foreignTotal}
                onChange={(e) => setForeignTotal(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
              />
              <div className="w-24 relative">
                <span className="absolute top-0 left-0 bottom-0 flex items-center pl-3 text-xs font-bold text-gray-400 dark:text-gray-500 pointer-events-none">x</span>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-6 pr-3 py-3 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">總件數 (數量)</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">總二補運費 (NT$)</label>
              <input
                type="number"
                min="0"
                value={shippingNTD}
                onChange={(e) => setShippingNTD(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* 計算結果呈現區塊 */}
        <div className="bg-gradient-to-br from-primary-dark to-primary/90 rounded-3xl p-6 shadow-md text-white relative overflow-hidden animate-in fade-in duration-300">
          <Calculator className="absolute right-0 bottom-0 opacity-[0.08] w-40 h-40 transform translate-x-6 translate-y-6 pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/20">
              <span className="text-sm font-medium text-primary-light">預估台幣總成本</span>
              <span className="text-xl font-bold">NT$ {Math.round(totalNTD).toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary-light">單件精算成本</span>
              <span className="text-lg font-bold text-white/90">NT$ {rawCostPerItem.toFixed(1)}</span>
            </div>

            <div className="bg-white/10 dark:bg-black/20 rounded-2xl p-5 mt-2 backdrop-blur-sm border border-white/20 dark:border-white/10 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white leading-tight">建議分攤單價<br/><span className="text-[10px] font-normal text-primary-light/80">已進位至 5/0 以便找零</span></span>
                <span className="text-3xl font-black text-amber-300 tracking-tight drop-shadow-sm">
                  ${suggestedPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
