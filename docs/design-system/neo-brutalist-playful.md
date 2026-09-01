# 俏皮野獸派 (Neo-Brutalist Playful) 完整設計系統與 Hard Prompt 規範

style_slug: `neo-brutalist-playful`
style_source: `/styles/neo-brutalist-playful`

---

## 📌 什麼時候使用
- 當希望 AI 或前端團隊**嚴格按風格規則生成/重構代碼**時使用。它是生產介面最穩定的預設標準。
- 把任務交給 AI 開發前，用此規範確定顏色、排版、邊框、陰影、動效與無障礙 (Accessibility) 邊界。
- 審核產出結果時，依「絕對禁止項」與「自檢清單」確認沒有風格漂移 (Style Drift)。

---

## 🎨 概覽與設計理念

Neo-Brutalist Playful（俏皮野獸派）是原版 Neo-Brutalist 的活潑變體。在保持純黑粗邊框、無圓角的硬質幾何結構基礎上，加入：
- 傾斜微旋轉 (`rotate-[-2deg]`, `rotate-[1deg]`)
- 多彩色塊與彩色硬影碰撞 (珊瑚紅 `#FF6B6B`、薄荷青 `#4ECDC4`、明黃 `#FFE66D` 等)
- 具備玩具回彈感的微交互與動效 (Toy Spring, Joyful Press)
- Lucide React 向量圖標點綴與幾何圖形裝飾

---

## 🚫 [FORBIDDEN] 絕對禁止項 (違規即重寫)

| 禁止項目 | 說明與替代方案 |
| :--- | :--- |
| **禁止圓角** | 嚴禁 `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` 等。**統一強制 `rounded-none`** |
| **禁止模糊陰影** | 嚴禁 `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg` 等模糊陰影。**僅允許硬邊實體陰影 (Hard Cut Shadows)** |
| **禁止漸變色** | 嚴禁 `bg-gradient-to-r`, `bg-gradient-to-b` 或漸變文字。**一律使用高飽和對比大塊純色** |
| **禁止旋轉超過 3 度** | 元素旋轉僅限 `-2deg` 至 `+1deg` 範圍，不可過度傾斜 |
| **禁止使用 Emoji 字符** | 嚴禁用 Emoji 做為 UI 圖標或裝飾。**一律使用 Lucide React 向量線性圖標** |
| **禁止柔和灰暗色** | 嚴禁 `text-gray-300`, `text-gray-400`, `text-gray-500`, `bg-gray-50`, `bg-gray-100` 等沉悶中性灰 |
| **禁止細弱字體** | 嚴禁 `font-light`, `font-thin`。標題強制 `font-black` 粗體大寫 |
| **禁止玻璃態** | 嚴禁 `backdrop-blur` 模糊玻璃效果 |

---

## 📐 Token 字典 (精確 Class 映射)

### 1. 邊框 (Borders)
- **邊框寬度**: `border-4`
- **邊框顏色**: `border-black` (#000000)
- **圓角**: `rounded-none`

### 2. 硬陰影 (Hard Cut Shadows)
- **小陰影**: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- **中陰影**: `shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]`
- **大陰影**: `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`
- **珊瑚紅硬影**: `shadow-[6px_6px_0px_0px_rgba(255,107,107,1)]`
- **薄荷青硬影**: `shadow-[6px_6px_0px_0px_rgba(78,205,196,1)]`
- **明黃硬影**: `shadow-[6px_6px_0px_0px_rgba(255,230,109,1)]`
- **懸停態**: `hover:shadow-none`
- **聚焦態**: `focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)]`

### 3. 交互與動效 (Interactions & Motion)
- **Toy Spring (玩具彈簧感)**: `transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]`
- **Tilt Exaggeration (傾斜反轉)**: 初始 `rotate-[-1.5deg]`，懸停時切換至 `hover:rotate-[1.5deg]`
- **悬停位移**: `hover:translate-x-[3px] hover:translate-y-[3px]` 或 `hover:-translate-y-2`
- **懸停縮放**: `hover:scale-105`
- **Joyful Press (壓扁按壓態)**: `:active` 狀態時 `active:scale-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`

### 4. 色彩角色 (Color Roles)
- **背景主色**: `bg-white` (純白)
- **背景輔色**: `bg-black` (純黑)
- **點綴撞色**:
  - 珊瑚紅: `bg-[#ff6b6b]` (`#FF6B6B`)
  - 薄荷青: `bg-[#4ecdc4]` (`#4ECDC4`)
  - 明亮黃: `bg-[#ffe66d]` (`#FFE66D`)
  - 青天綠: `bg-[#95e1d3]` (`#95E1D3`)
  - 蜜桃粉: `bg-[#f38181]` (`#F38181`)
- **文字主色**: `text-black`
- **文字輔色**: `text-white`
- **文字弱化色**: `text-gray-700`

---

## 🧩 [REQUIRED] 必須包含的組件範本

### 1. 經典按鈕 (Button)
```html
<button class="rounded-none border-4 border-black font-black bg-[#ff6b6b] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:scale-95 active:translate-x-[4px] active:translate-y-[4px] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
  點擊行動
</button>
```

### 2. 卡片 (Card)
```html
<div class="rounded-none border-4 border-black bg-white p-4 md:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-[-1deg] hover:rotate-[1deg] transition-all duration-300">
  <h3 class="font-black uppercase text-xl md:text-2xl text-black">卡片標題</h3>
  <p class="font-mono text-sm md:text-base text-gray-700 mt-2">卡片內容說明...</p>
</div>
```

### 3. 輸入框 (Input)
```html
<input 
  class="w-full rounded-none border-4 border-black bg-white font-mono px-4 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)] transition-all duration-200 text-black placeholder:text-gray-500 font-bold" 
  placeholder="請輸入文字..." 
/>
```

---

## 🔍 [CHECKLIST] 交付前自檢清單

- [ ] **無圓角確認**：全頁面沒有出現任何 `rounded-lg`, `rounded-full` 等軟圓角，統一 `rounded-none`。
- [ ] **無模糊陰影**：沒有使用 `shadow-md`, `shadow-lg` 等模糊陰影，全為 4px/6px/8px 實體硬陰影。
- [ ] **無漸變背景**：全頁面無 `bg-gradient-*`。
- [ ] **無過度旋轉**：元素傾斜未超過 3 度（保持在 `-2deg` ~ `+1deg`）。
- [ ] **無 Emoji 做圖標**：介面圖標皆採用 Lucide React 向量圖標。
- [ ] **高對比度可訪問性**：正文文字對比度符合 WCAG AA (≥4.5:1)，且 Focus 態保留清熱硬框。
