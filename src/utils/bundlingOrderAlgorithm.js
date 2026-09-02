/**
 * 揪拆團小助手 - 滯銷冷門角色分攤演算法（綁序機制，Bundling Order Engine）
 * 
 * 核心原則：
 * 1. 零滯銷約束 (Zero-Leftover Constraint)：所有未被認領的冷角池全數分配至 0。
 * 2. 責任單調性 (Strict Priority Chain)：依照品項熱度排名 (#1 為最熱門)，熱門角買家優先承擔吃土責任。
 * 3. 選綁方向解耦 (Decoupled Selection Order)：支援 forward (正序) 與 reverse (倒序) 選綁。
 */

/**
 * 計算綁序分攤結果
 * @param {Object} params
 * @param {Array} params.items 品項陣列 (需含 id, name, stock, sort_order)
 * @param {Array} params.participants 參團人員紀錄 (含 id, item_id, buyer_name, qty, timestamp)
 * @param {Map} params.allocatedMap 已通過配分引擎計算出的各參團紀錄中選數量
 * @param {number} params.maxBindPerUser 單人最高吃綁上限 (預設 1)
 * @param {string} params.pickMode 選綁策略: "forward" | "reverse"
 * @returns {Object} 包含綁定結果、挑選順序、餘額池、安全名單與文案
 */
export function computeBundlingOrder({
  items = [],
  participants = [],
  allocatedMap = new Map(),
  maxBindPerUser = 1,
  pickMode = 'forward'
}) {
  // 1. 統計品項庫存與中選餘額池 (Inventory Delta & Unallocated Items)
  const unallocatedItems = []; // 冷角池 (含重複實例，方便按件數分配)

  // 依照 sort_order (熱度) 排序品項
  const sortedItems = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  sortedItems.forEach((item) => {
    // 找出該品項所有獲得配分的總數
    const itemClaims = participants.filter((p) => Number(p.item_id) === Number(item.id));
    const totalAllocated = itemClaims.reduce((sum, p) => sum + (allocatedMap.get(p.id) || 0), 0);
    const leftoverStock = Math.max(0, (item.stock || 1) - totalAllocated);

    for (let i = 0; i < leftoverStock; i++) {
      unallocatedItems.push({
        id: item.id,
        name: item.name,
        image: item.image,
        sort_order: item.sort_order
      });
    }
  });

  const leftoverCount = unallocatedItems.length;

  // 若殘餘冷角數量為 0，直接回傳完售結果
  if (leftoverCount === 0) {
    return {
      leftoverCount: 0,
      unallocatedItems: [],
      boundUsers: [],
      pickOrder: [],
      unaffectedUsers: [],
      automaticAllocations: [],
      copyNoticeText: '【團務通知】🎉 本團所有商品皆已全數認領完畢，無剩餘滯銷冷角，感謝各位參團！'
    };
  }

  // 2. 確定承擔者隊列 (Identify Bound Users)
  // 按品項熱度從最熱門 (#1) 開始遍歷，收集熱門角買家
  const candidateUsersSequence = [];
  const processedUserSet = new Set();

  sortedItems.forEach((item) => {
    // 找出獲得該熱門角的買家
    const winners = participants
      .filter((p) => Number(p.item_id) === Number(item.id) && (allocatedMap.get(p.id) || 0) > 0)
      .map((p) => p.buyer_name);

    winners.forEach((buyerName) => {
      if (!processedUserSet.has(buyerName)) {
        processedUserSet.add(buyerName);
        candidateUsersSequence.push({
          buyerName,
          topClaimItem: item.name,
          topSortOrder: item.sort_order
        });
      }
    });
  });

  // 挑選前 leftoverCount 位買家入列吃綁
  const boundUsers = [];
  const unaffectedUsers = [];

  candidateUsersSequence.forEach((cand) => {
    if (boundUsers.length < leftoverCount) {
      boundUsers.push({
        rank: boundUsers.length + 1,
        buyerName: cand.buyerName,
        topClaimItem: cand.topClaimItem
      });
    } else {
      unaffectedUsers.push(cand.buyerName);
    }
  });

  // 3. 決定選物順序 (Determine Pick Sequence)
  let pickOrder = [];
  if (pickMode === 'reverse') {
    // 倒序選綁：後列買家優先挑選
    pickOrder = [...boundUsers].reverse().map((user, idx) => ({
      ...user,
      pickIndex: idx + 1
    }));
  } else {
    // 正序選綁：熱門角買家優先挑選
    pickOrder = [...boundUsers].map((user, idx) => ({
      ...user,
      pickIndex: idx + 1
    }));
  }

  // 4. 模式 A 貪婪自動分配 (Greedy Allocation)
  const automaticAllocations = [];
  const remainingPool = [...unallocatedItems];

  pickOrder.forEach((user) => {
    if (remainingPool.length > 0) {
      const assignedItem = remainingPool.shift(); // 依序取出一件冷角
      automaticAllocations.push({
        buyerName: user.buyerName,
        itemId: assignedItem.id,
        itemName: assignedItem.name,
        isBound: true,
        note: `綁定冷角: ${assignedItem.name}`
      });
    }
  });

  // 5. 模式 B 產生挑選通知隊列文案 (Generate Announcement Copy Text)
  const copyNoticeText = generatePickQueueNoticeText({
    leftoverCount,
    unallocatedItems,
    pickOrder,
    unaffectedUsers,
    pickMode
  });

  return {
    leftoverCount,
    unallocatedItems,
    boundUsers,
    pickOrder,
    unaffectedUsers,
    automaticAllocations,
    copyNoticeText
  };
}

/**
 * 產生條理清晰的社群挑選通知隊列文案
 */
export function generatePickQueueNoticeText({
  leftoverCount,
  unallocatedItems = [],
  pickOrder = [],
  unaffectedUsers = [],
  pickMode = 'forward'
}) {
  // 統計冷角池種類數量
  const itemCountsMap = new Map();
  unallocatedItems.forEach((item) => {
    itemCountsMap.set(item.name, (itemCountsMap.get(item.name) || 0) + 1);
  });

  const poolSummaryText = Array.from(itemCountsMap.entries())
    .map(([name, qty]) => `${name} x ${qty}`)
    .join('、');

  let text = `【團務公告】冷門角色綁定與選角順序通知\n`;
  text += `----------------------------------------\n`;
  text += `📦 本團待綁定滯銷冷角池 (${leftoverCount} 件)：\n`;
  text += `👉 ${poolSummaryText || '無'}\n\n`;

  text += `🎯 依熱度責任順序，請以下團員按順序挑選綁物 (${pickMode === 'reverse' ? '倒序挑選' : '正序挑選'})：\n`;
  if (pickOrder.length > 0) {
    pickOrder.forEach((u) => {
      text += `${u.pickIndex}. @${u.buyerName} (喊中 ${u.topClaimItem})\n`;
    });
  } else {
    text += `（無須綁物）\n`;
  }

  if (unaffectedUsers.length > 0) {
    text += `\n🛡️ 安全名單 (名額已滿免吃綁)：\n`;
    text += `${unaffectedUsers.map((name) => `@${name}`).join('、')}\n`;
  }

  text += `----------------------------------------\n`;
  text += `請被標記的團員依序於留言區挑選欲綁定的品項，感謝大家的配合與支持！`;

  return text;
}
