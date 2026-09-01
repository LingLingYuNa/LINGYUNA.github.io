# 俏皮野獸派 (Neo-Brutalist Playful) 設計規範

style_slug: `neo-brutalist-playful`

---

## 📌 什麼時候使用
- 在前端開發、組件重構或與 AI 協作時，需要統一團隊對「俏皮野獸派」風格的設計認知。
- 交付 UI 任務前，明確限定顏色、邊框、陰影、動效與可訪問性 (Accessibility) 邊界。
- 進行 Code Review 或 UI 設計審核時，判斷產出的介面是否符合此設計語言。

---

## 💡 使用指引
1. **概覽與視覺核心**：理解俏皮野獸派的核心特徵（硬邊框、無圓角、大膽對比、微旋轉與豐富色彩）。
2. **組件與布局邊界**：將布局與組件規則作為 Tailwind CSS 實作邊界。
3. **自檢清單**：上線或提交 PR 前，按「交付檢查」逐條確認。

---

## 🎨 概覽與設計意圖
Neo-Brutalist Playful（俏皮野獸派）是傳統新野獸派 (Neo-Brutalism) 的活潑變體。在保留**純黑硬邊框 (border-4 border-black)**與**零圓角 (rounded-none)**的高強度幾何結構基礎上，加入多款鮮艷強調色、微幅傾斜旋轉、Lucide 圖標裝飾與高回饋感的微交互，特別適合年輕化、充滿活力與彰顯特性的數位產品。

---

## 🌈 視覺系統 (Visual System)

- **主色 (Primary)**: `#000000` (純黑)
- **底色/次色 (Secondary)**: `#FFFFFF` (純白)
- **點綴強調色 (Accents)**:
  - 珊瑚紅: `#FF6B6B`
  - 薄荷綠: `#4ECDC4`
  - 明亮黃: `#FFE66D`
  - 青天綠: `#95E1D3`
  - 蜜桃粉: `#F38181`
- **視覺特徵標籤 (Signature Cues)**:
  `俏皮野獸派` | `高色彩飽和度` | `傾斜旋轉` | `幾何硬質` | `粗黑邊框` | `實體陰影`

---

## 📐 布局規則 (Layout Rules)

| 項目 | Tailwind CSS Class 規範 | 說明 |
| :--- | :--- | :--- |
| **區塊垂直節奏** | `py-12 md:py-20 lg:py-28` | 大邊距與大呼吸感 |
| **容器水平內邊距** | `px-4 md:px-8 lg:px-12` | 響應式容器邊距 |
| **卡片內邊距** | `p-4 md:p-6` | 清晰內框間距 |
| **預設元件間距** | `gap-4 md:gap-6` | 硬質網格分隔 |
| **圓角規範** | `rounded-none` | **嚴格禁止任何圓角** |

---

## 🧩 組件實作規則 (Component Rules)

1. **圓角**：一律強制 `rounded-none`。
2. **邊框**：使用顯眼的粗純黑邊框 `border-4 border-black`。
3. **微旋轉 (Tilt)**：卡片或標籤可加上輕微傾斜，如 `rotate-[-2deg]` 或 `rotate-[1deg]`。
4. **色彩應用**：區塊與按鈕搭配大膽的點綴色（如珊瑚紅 `#FF6B6B` 或明亮黃 `#FFE66D`）。
5. **懸停微效 (Hover)**：
   - 實體陰影平移：`hover:translate-x-[3px] hover:translate-y-[3px]`
   - 放大效果：`hover:scale-105`
6. **實體硬陰影 (Brutalist Shadow)**：
   - 純黑硬陰影：`shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
   - 彩色硬陰影：`shadow-[6px_6px_0px_0px_rgba(255,107,107,1)]` 或 `shadow-[6px_6px_0px_0px_rgba(78,205,196,1)]`
7. **圖標裝飾**：使用風格統一的向量圖標（如 Lucide React），增加視覺直覺度。

---

## ⚡ 交互與動效 (Interactions & Motion)

- **過渡動效 (Transition)**: `transition-all duration-300`
- **懸停態 (Hover)**: `hover:translate-x-[3px] hover:translate-y-[3px]`
- **按下態 (Active)**: `active:translate-x-[4px] active:translate-y-[4px]`
- **聚焦態 (Focus)**: `focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(78,205,196,1)]`
- **動效原則**：動效必須敏捷有反饋，嚴禁引發周圍布局大幅位移或奪走使用者焦點。

---

## ♿ 可訪問性 (Accessibility & Compliance)

- **對比度要求**：文字與背景色對比度須嚴格維持在 **WCAG AA 或更高**（黑字搭亮色背景）。
- **鍵盤焦點**：每個可互動元素（按鈕、輸入框、連結）均須保留清晰的高對比 Focus 實體框。
- **觸控目標**：行動端點擊範圍不得小於 `44px x 44px`。
- **動效相容**：尊重系統 `prefers-reduced-motion` 設定。

---

## 🚫 嚴格禁止項 (Forbidden Practices)

- ✕ **禁止使用任何圓角** (`rounded-lg`, `rounded-full` 等一律禁止，統一為 `rounded-none`)
- ✕ **禁止使用柔和/模糊陰影** (`shadow-md`, `shadow-lg`, `blur-*` 一律禁止，僅允許 Hard Cut / Drop Solid Shadow)
- ✕ **禁止使用漸變色** (`bg-gradient-*` 一律禁止，使用大塊純色撞色)
- ✕ **禁止旋轉超過 3 度** (旋轉角度限 `rotate-[-2deg]` 至 `rotate-[2deg]`)
- ✕ **禁止使用 Emoji 替代符號字符做為圖標** (統一使用 Lucide 向量圖標)
- ✕ **禁止使用柔和低對比灰色** (避免灰暗無生氣的調性)

---

## 🔍 交付檢查清單 (Delivery Checklist)

- [ ] 頁面整體視覺呈現高度識別的「俏皮野獸派」大膽撞色與硬朗風格。
- [ ] 按鈕、卡片、輸入框、空狀態與彈窗全套組件共享同一套設計語言。
- [ ] 檢查沒有任何通用組件庫預設的「軟圓角」或「模糊陰影」殘留。
- [ ] 鍵盤 Focus 態與 Hover 懸停態互動反饋明確順暢。
