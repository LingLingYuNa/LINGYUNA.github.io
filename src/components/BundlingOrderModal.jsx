import React, { useState, useMemo } from 'react';
import { X, Copy, Check, ShieldCheck, HelpCircle, Layers, ArrowDownUp } from 'lucide-react';
import { computeBundlingOrder } from '../utils/bundlingOrderAlgorithm';

export default function BundlingOrderModal({
  isOpen,
  onClose,
  items = [],
  participants = [],
  allocatedMap = new Map(),
  onApplyAutomaticAllocations
}) {
  const [pickMode, setPickMode] = useState('forward'); // 'forward' | 'reverse'
  const [maxBindPerUser, setMaxBindPerUser] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // 算出演算法結果
  const result = useMemo(() => {
    return computeBundlingOrder({
      items,
      participants,
      allocatedMap,
      maxBindPerUser: Number(maxBindPerUser) || 1,
      pickMode
    });
  }, [items, participants, allocatedMap, maxBindPerUser, pickMode]);

  if (!isOpen) return null;

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(result.copyNoticeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleApplyAuto = async () => {
    if (result.automaticAllocations.length === 0) {
      alert('無須自動分配：全團無滯銷冷角！');
      return;
    }
    if (!window.confirm(`確定要自動將 ${result.automaticAllocations.length} 件滯銷冷角配發至吃綁團員名下嗎？`)) {
      return;
    }

    try {
      setIsApplying(true);
      if (onApplyAutomaticAllocations) {
        await onApplyAutomaticAllocations(result.automaticAllocations);
      }
      onClose();
    } catch (err) {
      console.error('自動分配綁物失敗:', err);
      alert('分配失敗，請重試！');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-[#FFFDF7] dark:bg-gray-900 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-[#FFE66D] border-b-4 border-black flex items-center justify-between shrink-0 text-black">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-black text-white border border-black shrink-0">
              <Layers size={18} strokeWidth={2.5} />
            </div>
            <h3 className="font-black text-base uppercase tracking-wider">
              滯銷冷角綁序分攤引擎 (Bundling Order Engine)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto bg-[#f7f1df] dark:bg-gray-800 flex-1">
          
          {/* 控制面板：選綁模式與單人吃綁上限 */}
          <div className="bg-white dark:bg-gray-900 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-black text-black dark:text-white uppercase tracking-wider block">
                  挑選順序策略 (pick_mode)
                </span>
                <p className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
                  解耦模式：判定吃綁責任後，決定買家挑選冷角的排隊方向
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPickMode('forward')}
                  className={`px-3 py-1.5 border-2 border-black font-black text-xs transition-all cursor-pointer ${
                    pickMode === 'forward'
                      ? 'bg-[#4ECDC4] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  正序挑選 (熱門優先)
                </button>
                <button
                  type="button"
                  onClick={() => setPickMode('reverse')}
                  className={`px-3 py-1.5 border-2 border-black font-black text-xs transition-all cursor-pointer ${
                    pickMode === 'reverse'
                      ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  倒序挑選 (後列優先)
                </button>
              </div>
            </div>
          </div>

          {/* 1. 待分攤滯銷冷角池與統計卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#FF6B6B] text-white p-3.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs font-black uppercase block tracking-wider">總滯銷待綁定數</span>
              <span className="text-3xl font-black font-mono mt-1 block">{result.leftoverCount} 件</span>
            </div>
            <div className="bg-[#FFE66D] text-black p-3.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs font-black uppercase block tracking-wider">吃綁責任人數</span>
              <span className="text-3xl font-black font-mono mt-1 block">{result.boundUsers.length} 人</span>
            </div>
            <div className="bg-[#4ECDC4] text-black p-3.5 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs font-black uppercase block tracking-wider">安全免綁人數</span>
              <span className="text-3xl font-black font-mono mt-1 block">{result.unaffectedUsers.length} 人</span>
            </div>
          </div>

          {/* 2. 吃綁與挑選隊列展示 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-black dark:text-white tracking-wider flex items-center gap-1.5">
                <ArrowDownUp size={14} strokeWidth={2.5} />
                <span>買家挑選順序隊列 ({result.pickOrder.length} 人)</span>
              </span>
            </div>

            {result.pickOrder.length > 0 ? (
              <div className="space-y-2">
                {result.pickOrder.map((u) => (
                  <div
                    key={u.buyerName}
                    className="p-3 bg-white dark:bg-gray-900 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-black text-white font-mono font-black text-xs flex items-center justify-center border border-black">
                        #{u.pickIndex}
                      </span>
                      <div>
                        <span className="font-black text-sm text-black dark:text-white block">{u.buyerName}</span>
                        <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                          認領熱門角：{u.topClaimItem}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-[#FFE66D] text-black px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      須吃綁 1 件
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-100 text-emerald-900 border-2 border-black font-mono font-bold text-xs text-center">
                🎉 本團全數熱門與冷門品項皆已售罄，無剩餘冷角！
              </div>
            )}
          </div>

          {/* 3. 安全免綁名單 (若有) */}
          {result.unaffectedUsers.length > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-black space-y-1">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1">
                <ShieldCheck size={14} strokeWidth={2.5} />
                <span>安全逃脫名單 (熱門角名額已滿，免承擔吃綁)：</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.unaffectedUsers.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-black text-xs font-mono font-bold text-black dark:text-white"
                  >
                    @{name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 4. 社群挑選隊列通知文案預覽 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-black dark:text-white tracking-wider">
                社群團務挑選通知文案
              </span>
              <button
                type="button"
                onClick={handleCopyNotice}
                className="px-3 py-1 bg-[#FFE66D] hover:bg-amber-300 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                <span>{isCopied ? '已複製文案' : '複製挑選文案'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={7}
              value={result.copyNoticeText}
              className="w-full bg-white dark:bg-gray-900 border-4 border-black p-3 font-mono text-xs font-bold text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
            />
          </div>
        </div>

        {/* Footer 操作區域 */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t-4 border-black flex flex-col sm:flex-row justify-end items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-black dark:text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer"
          >
            關閉視窗
          </button>
          <button
            type="button"
            disabled={result.automaticAllocations.length === 0 || isApplying}
            onClick={handleApplyAuto}
            className="w-full sm:w-auto px-6 py-2 bg-[#FF6B6B] hover:bg-red-500 disabled:opacity-40 text-white border-4 border-black font-black text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Check size={16} strokeWidth={3} />
            <span>一鍵自動貪婪吃綁 ({result.automaticAllocations.length} 件)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
