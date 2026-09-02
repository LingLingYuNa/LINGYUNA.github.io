import React, { useState } from 'react';
import { Calculator, Package, Sparkles, Scale } from 'lucide-react';
import { EXCHANGE_RATES } from '../constants';
import BoxSplitManager from './BoxSplitManager';

export default function SplitOrder() {
  const [activeSubTab, setActiveSubTabState] = useState(() => {
    return localStorage.getItem('split_order_active_subtab') || 'split_box';
  });

  const setActiveSubTab = (tab) => {
    setActiveSubTabState(tab);
    localStorage.setItem('split_order_active_subtab', tab);
  };

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
    <div className="min-h-screen bg-[#f7f1df] dark:bg-[#121212]">
      {/* 頂部功能切換選項卡 (Sticky Sub-Tab) */}
      <div className="bg-[#f7f1df] dark:bg-[#121212] border-b-4 border-black sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 flex justify-center py-2">
          <div className="flex bg-white dark:bg-gray-800 p-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveSubTab('split_box')}
              className={`flex-1 py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                activeSubTab === 'split_box'
                  ? 'bg-[#FFE66D] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-black dark:text-white hover:bg-[#4ECDC4]/20'
              }`}
            >
              <Package size={15} strokeWidth={2.5} />
              <span>揪拆團小助手</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('calculator')}
              className={`flex-1 py-2 px-3 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                activeSubTab === 'calculator'
                  ? 'bg-[#4ECDC4] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-black dark:text-white hover:bg-[#FFE66D]/20'
              }`}
            >
              <Calculator size={15} strokeWidth={2.5} />
              <span>試算機</span>
            </button>
          </div>
        </div>
      </div>

      {/* 內容區塊 */}
      {activeSubTab === 'split_box' ? (
        <BoxSplitManager />
      ) : (
        <div className="p-4 space-y-6 max-w-4xl mx-auto md:py-8 pb-32 bg-[#f7f1df] dark:bg-[#121212]">
          {/* 標題區 */}
          <header className="px-1 mt-2 mb-4">
            <h1 className="text-2xl font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calculator size={26} strokeWidth={2.5} />
              <span>團購與拆團試算機</span>
            </h1>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-mono font-bold">快速試算盲盒、團購分攤與集運運費重量分攤 (COST CALCULATOR)</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* 參數輸入區塊 */}
            <div className="bg-white dark:bg-gray-800 rounded-none p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-black space-y-5 transition-colors">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-black dark:text-white uppercase">外幣總金額</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setExchangeRate(EXCHANGE_RATES.RMB)} 
                      className={`text-xs px-2.5 py-1 rounded-none font-black border-2 border-black transition-all cursor-pointer ${Number(exchangeRate) === EXCHANGE_RATES.RMB ? 'bg-[#FFE66D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}`}
                    >
                      RMB
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setExchangeRate(EXCHANGE_RATES.JPY)} 
                      className={`text-xs px-2.5 py-1 rounded-none font-black border-2 border-black transition-all cursor-pointer ${Number(exchangeRate) === EXCHANGE_RATES.JPY ? 'bg-[#FFE66D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}`}
                    >
                      JPY
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setExchangeRate(1.0)} 
                      className={`text-xs px-2.5 py-1 rounded-none font-black border-2 border-black transition-all cursor-pointer ${Number(exchangeRate) === 1.0 ? 'bg-[#FFE66D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}`}
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
                    className="flex-1 bg-white dark:bg-gray-700 border-4 border-black rounded-none px-4 py-2.5 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white placeholder:text-gray-400"
                  />
                  <div className="w-28 relative">
                    <span className="absolute top-0 left-0 bottom-0 flex items-center pl-3 text-xs font-black text-black dark:text-gray-400 pointer-events-none">x</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none pl-7 pr-3 py-2.5 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black dark:text-white uppercase">總件數 (數量)</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-4 py-2.5 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-black dark:text-white uppercase">二補運費 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={shippingNTD}
                    onChange={(e) => setShippingNTD(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-4 py-2.5 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* 計算結果呈現區塊 (鮮明紅色粗邊框卡片) */}
            <div className="bg-[#FF6B6B] text-black border-4 border-black rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-0.5deg] relative overflow-hidden">
              <Calculator className="absolute right-0 bottom-0 opacity-10 w-40 h-40 transform translate-x-6 translate-y-6 pointer-events-none text-black" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b-2 border-black">
                  <span className="text-xs font-black uppercase tracking-wider">預估台幣總成本</span>
                  <span className="text-2xl font-black font-mono">NT$ {Math.round(totalNTD).toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider">單件精算成本</span>
                  <span className="text-xl font-black font-mono">NT$ {rawCostPerItem.toFixed(1)}</span>
                </div>

                <div className="bg-[#FFE66D] border-4 border-black rounded-none p-4 mt-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-black uppercase block">建議分攤單價</span>
                      <span className="text-[10px] font-mono font-bold text-gray-800 block">(進位至 5/0 便於找零)</span>
                    </div>
                    <span className="text-3xl font-black font-mono tracking-tight">
                      ${suggestedPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 重量分攤試算器 (鮮明特調黃色黑邊卡片) */}
          <div className="bg-white dark:bg-gray-800 rounded-none p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-4 border-black space-y-5 transition-colors mt-6">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-black">
              <Scale size={20} strokeWidth={2.5} className="text-black dark:text-white" />
              <h2 className="text-base font-black text-black dark:text-white uppercase tracking-wider">集運運費重量分攤試算</h2>
            </div>

            {/* 輸入區 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-black dark:text-white uppercase">單件物品重量</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemWeight}
                  onChange={(e) => setItemWeight(e.target.value)}
                  placeholder="0.5"
                  className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-3 py-2 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-black dark:text-white uppercase">集運總重量</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  placeholder="5.0"
                  className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-3 py-2 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-black dark:text-white uppercase">集運總運費 (外幣)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalShipping}
                  onChange={(e) => setTotalShipping(e.target.value)}
                  placeholder="100"
                  className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-3 py-2 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-black dark:text-white uppercase">運費匯率</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={shippingExchangeRate}
                  onChange={(e) => setShippingExchangeRate(e.target.value)}
                  placeholder="5.5"
                  className="w-full bg-white dark:bg-gray-700 border-4 border-black rounded-none px-3 py-2 text-sm font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none text-black dark:text-white"
                />
              </div>
            </div>

            {/* 結果區 (黃色粗邊框卡片) */}
            <div className="bg-[#FFE66D] border-4 border-black rounded-none p-5 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-black uppercase tracking-wider block">重量佔比</span>
                  <span className="text-base font-black font-mono">
                    {weightRatio.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-0.5 border-x-2 border-black">
                  <span className="text-[10px] font-black text-black uppercase tracking-wider block">分攤外幣</span>
                  <span className="text-base font-black font-mono">
                    {sharedForeignFee.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-black uppercase tracking-wider block">最終台幣運費</span>
                  <span className="text-lg font-black font-mono">
                    NT$ {Math.round(finalTwdFee).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 進度條 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase">
                  <span>包裹重量佔比進度條</span>
                  <span>{weightRatio.toFixed(1)}% / 100%</span>
                </div>
                <div className="w-full bg-white border-2 border-black h-4 rounded-none overflow-hidden p-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div 
                    className="bg-[#FF6B6B] border-r-2 border-black h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, weightRatio)}%` }}
                  />
                </div>
              </div>

              <div className="text-center pt-2 border-t-2 border-black">
                <code className="text-xs text-black font-mono font-bold block select-all bg-white border-2 border-black px-3 py-1.5 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
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
