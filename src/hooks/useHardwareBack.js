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
      const currentHash = window.location.hash;
      // 只有在當前 hash 不包含該 hashName 時才追加，避免重複推入歷史
      if (!currentHash.includes(hashName)) {
        const prefix = (currentHash === '' || currentHash === '#') ? '#/' : `${currentHash}/`;
        window.history.pushState(null, '', `${prefix}${hashName}`);
      }
    } else {
      const currentHash = window.location.hash;
      // 如果目前 hash 是以自己的 hashName 結尾，代表主動關閉時需要後退歷史將此 hash 移除
      if (currentHash.endsWith(`/${hashName}`)) {
        window.history.back();
      }
    }
  }, [isOpen, hashName]);

  useEffect(() => {
    const handlePopState = () => {
      // popstate 觸發時，如果已經不再包含自己的 hashName，說明歷史已經倒退到該層級之外，執行關閉
      if (isOpen && !window.location.hash.includes(hashName)) {
        closeAction();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, hashName, closeAction]);

  const handleCloseUI = useCallback(() => {
    // UI 按鈕主動關閉時，如果是最上層的 hash 段則後退歷史，否則 fallback 直接關閉
    if (window.location.hash.endsWith(`/${hashName}`)) {
      window.history.back();
    } else {
      closeAction();
    }
  }, [hashName, closeAction]);

  return handleCloseUI;
}
