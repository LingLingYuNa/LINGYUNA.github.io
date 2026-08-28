import React, { useState } from 'react';
import { Calculator, Package, Sparkles } from 'lucide-react';
import { EXCHANGE_RATES } from '../constants';
import BoxSplitManager from './BoxSplitManager';

export default function SplitOrder() {
  const [activeSubTab, setActiveSubTab] = useState('split_box'); // 'split_box' | 'calculator'

  // 原有計算機邏輯
  const [foreignTotal, setForeignTotal] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [shippingNTD, setShippingNTD] = useState('');
  const [exchangeRate, setExchangeRate] = useState(EXCHANGE_RATES.RMB);

  // 重量分攤狀態
  const [itemWeight, setItemWeight] = useState('0.5');
  const [totalWeight, setTotalWeight] = useState('5.0');
  const [totalShipping, setTotalShipping] = useState('100');
  const [shippingExchangeRate, setShippingExchangeRate] = useState('5.5');

  const calculateCosts = () => {
    const totalQty = Number(quantity) || 1;
    const fTotal = Number(foreignTotal) || 0;
    const sNTD = Number(shippingNTD) || 0;
    const rate = Number(exchangeRate) || 1;

    const totalNTD = (fTotal * rate) + sNTD;
    const rawCostPerItem = totalNTD / totalQty;
    const suggestedPrice = Math.ceil(rawCostPerItem / 5) * 5;

    return { totalNTD, rawCostPerItem, suggestedPrice };
  };

  const { totalNTD, rawCostPerItem, suggestedPrice } = calculateCosts();

  const iw = Number(itemWeight) || 0;
  const tw = Number(totalWeight) || 0;
  const ts = Number(totalShipping) || 0;
  const er = Number(shippingExchangeRate) || 0;

  const weightRatio = tw > 0 ? (iw / tw) * 100 : 0;
  const sharedForeignFee = tw > 0 ? (iw / tw) * ts : 0;
  const finalTwdFee = sharedForeignFee * er;

  return (
    <div className="min-h-screen">
      {/* 頂部功能切換選項卡 (Sticky Sub-Tab) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-150 dark:border-gray-800 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 flex justify-center">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 my-2 rounded-2xl w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveSubTab('split_box')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeSubTab === 'split_box'
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Package size={15} />
              <span>📦 揪拆團小助手</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('calculator')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeSubTab === 'calculator'
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Calculator size={15} />
              <span>🧮 試算機</span>
            </button>
          </div>
        </div>
      </div>

      {/* 內容區塊 */}
      {activeSubTab === 'split_box' ? (
        <BoxSplitManager />
      ) : (
        <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32">
          {/* 標題區 */}
          <header className="px-1 mt-2 mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">🧮 專屬計算機</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">快速試算盲盒、團購分攤與集運運費重量分攤</p>
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

          {/* 重量分攤試算器 */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/80 space-y-5 transition-colors mt-6 animate-in fade-in duration-305">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-gray-700/60">
              <span className="text-lg">⚖️</span>
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">集運運費重量分攤試算</h2>
            </div>

            {/* 輸入區 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">單件物品重量</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemWeight}
                  onChange={(e) => setItemWeight(e.target.value)}
                  placeholder="0.5"
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">集運總重量</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  placeholder="5.0"
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">集運總運費 (外幣)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalShipping}
                  onChange={(e) => setTotalShipping(e.target.value)}
                  placeholder="100"
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">運費匯率</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={shippingExchangeRate}
                  onChange={(e) => setShippingExchangeRate(e.target.value)}
                  placeholder="5.5"
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {/* 結果區 */}
            <div className="bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">重量佔比</span>
                  <span className="text-base font-black text-primary-dark dark:text-primary-light">
                    {weightRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-0.5 border-x border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">分攤外幣</span>
                  <span className="text-base font-black text-gray-700 dark:text-gray-300">
                    {sharedForeignFee.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">最終台幣運費</span>
                  <span className="text-lg font-black text-emerald-650 dark:text-emerald-450">
                    NT$ {Math.round(finalTwdFee).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 進度條 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 dark:text-gray-500">
                  <span>包裹重量佔比進度條</span>
                  <span>{weightRatio.toFixed(1)}% / 100%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, weightRatio)}%` }}
                  />
                </div>
              </div>

              <div className="text-center pt-1.5 border-t border-gray-150/40 dark:border-gray-800">
                <code className="text-xs text-gray-500 dark:text-gray-400 font-mono block select-all bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                  ({iw.toFixed(2)} / {tw.toFixed(2)}) * {ts.toFixed(2)} * {er.toFixed(4)} = {Math.round(finalTwdFee)} 台幣
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
