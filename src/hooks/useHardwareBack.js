import { useEffect, useCallback } from 'react';

/**
 * 處理手機端硬體返回鍵 (Hardware Back Button) 與瀏覽器上一頁行為的 Hook
 * 
 * @param {boolean} isOpen - 目前 Modal 或全螢幕頁面是否為開啟狀態
 * @param {Function} closeAction - 用來關閉該頁面的 state update function (e.g., setIsOpen(false))
 * @param {string} hashName - 該頁面對應的虛擬路由名稱 (不含 #，例如 'add-order')
 * @returns {Function} handleCloseUI - 提供給 UI 上的「返回/關閉」按鈕綁定使用
 */
export function useHardwareBack(isOpen, closeAction, hashName) {
  useEffect(() => {
    if (isOpen) {
      // 1. 當元件開啟時，推入對應的 hash
      // 注意：這裡只改變 hash，不會重載頁面，但會真實在 history 產生一筆新紀錄
      const currentHash = window.location.hash;
      if (currentHash !== `#${hashName}`) {
        window.history.pushState(null, '', `#${hashName}`);
      }
    } else {
      // 2. 當元件因為其他原因被關閉 (例如表單儲存成功觸發 closeAction)
      // 這時我們要負責把當初推入的 hash 幫忙清掉 (也就是模擬返回)，維持 history 乾淨
      if (window.location.hash === `#${hashName}`) {
        window.history.back();
      }
    }
  }, [isOpen, hashName]);

  useEffect(() => {
    // 3. 監聽瀏覽器的 popstate 事件 (使用者按了手機的實體返回鍵，或瀏覽器上一頁)
    const handlePopState = () => {
      // 如果目前是開啟狀態，且 hash 已經不是自己的 hashName，代表使用者按了返回鍵離開了這個虛擬路由
      if (isOpen && window.location.hash !== `#${hashName}`) {
        closeAction();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, hashName, closeAction]);

  // 4. 提供給 UI 按鈕 (例如左上角的 X 或返回箭頭) 使用
  const handleCloseUI = useCallback(() => {
    if (window.location.hash === `#${hashName}`) {
      window.history.back(); // 觸發 popstate，上面的 listener 就會呼叫 closeAction
    } else {
      closeAction(); // 如果 hash 已經不是自己的，作為 fallback 直接關閉
    }
  }, [hashName, closeAction]);

  return handleCloseUI;
}
