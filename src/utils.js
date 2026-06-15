export const compressImage = (file, maxWidth = 800) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getDeadlineInfo = (deadlineStr) => {
  if (!deadlineStr) return null;
  
  const deadline = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(deadline);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      type: 'overdue',
      days: Math.abs(diffDays),
      text: `已逾期 ${Math.abs(diffDays)} 天`,
      colorClass: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-150/40 dark:border-red-900/40'
    };
  } else if (diffDays <= 3) {
    return {
      type: 'warning',
      days: diffDays,
      text: `即將到期：剩餘 ${diffDays} 天`,
      colorClass: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border border-orange-150/40 dark:border-orange-900/40'
    };
  } else {
    return {
      type: 'normal',
      days: diffDays,
      text: `剩餘 ${diffDays} 天`,
      colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80 border border-gray-150/40 dark:border-gray-700/40'
    };
  }
};

/**
 * 依據公式計算訂單最終台幣金額（含手續費%、服務費%、運費與折扣）
 * @param {Object} order 訂單物件
 * @param {Array} items 子物品陣列（選填）
 * @returns {number} 四捨五入後的台幣金額
 */
export const calculateOrderTotalTWD = (order, items = []) => {
  // 如果是日常記帳，直接回傳總額（日常記帳直接記台幣）
  if (order.order_type === 'daily' || order.tag_category === 'general') {
    return Math.round(Number(order.total_amount) || 0);
  }

  // 1. 商品基數 A (台幣)
  let baseAmount = 0;
  if (items && items.length > 0) {
    const itemsForeignTotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    baseAmount = itemsForeignTotal * (Number(order.exchange_rate) || 1);
  } else {
    baseAmount = (Number(order.total_amount) || 0) * (Number(order.exchange_rate) || 1);
  }

  // 2. 稅費與折價百分比/金額
  const handlingFeePercent = Number(order.handling_fee_percent) || 0;
  const remittanceFee = Number(order.remittance_fee) || 0;
  const shippingFee = Number(order.shipping_fee) || Number(order.global_shipping_fee) || 0;
  const discountAmount = Number(order.discount_amount) || Number(order.discount) || 0;

  const handlingFee = baseAmount * (handlingFeePercent / 100);

  // 3. 最終台幣總計
  const totalTWD = baseAmount + handlingFee + remittanceFee + shippingFee - discountAmount;
  return Math.round(totalTWD);
};


