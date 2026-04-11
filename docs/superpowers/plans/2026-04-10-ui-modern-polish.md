# UI Modern Polish Implementation Plan (Inter + Slate)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the dashboard's visual identity using the "Inter" font, optimized spacing, and a professional Slate/Blue color palette.

**Architecture:** 
- **Typography:** Import Google Fonts (Inter) in the main HTML and set it as the default font in Tailwind/CSS.
- **Global Styles:** Clean up `index.css` to remove conflicting legacy styles.
- **Component Polish:** Update `Sidebar.tsx`, `AIConfig.tsx`, and `DashboardHome.tsx` with consistent Tailwind classes for spacing, borders, and rounded corners.

**Tech Stack:** React, Tailwind CSS v4, Google Fonts.

---

### Task 1: Typography & Global Styles

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Import Inter font in `index.html`**

```html
<!-- frontend/index.html -->
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ...
</head>
```

- [ ] **Step 2: Update `index.css` with global resets and Inter font**

```css
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root {
  font-family: "Inter", sans-serif;
}

body {
  @apply bg-slate-50 text-slate-900 antialiased;
}

h1, h2, h3, h4 {
  @apply font-bold tracking-tight text-slate-900;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "ui: import Inter font and setup global styles"
```

---

### Task 2: Polish Sidebar Component

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Refine Sidebar spacing and typography**

```tsx
// frontend/src/components/Sidebar.tsx
// Update the NavLink classes for better spacing and font weight
className={({ isActive }) =>
  `flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
    isActive 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
  }`
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "ui: polish sidebar with better spacing and active states"
```

---

### Task 3: Polish AI Configuration Page

**Files:**
- Modify: `frontend/src/pages/Dashboard/AIConfig.tsx`

- [ ] **Step 1: Update AIConfig UI with rounded-xl and better spacing**

```tsx
// frontend/src/pages/Dashboard/AIConfig.tsx
// Update the main container and headers
<h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configuração de IA</h2>
...
<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/AIConfig.tsx
git commit -m "ui: polish AI configuration page layout"
```

---

### Task 4: Polish Dashboard Home & Layout

**Files:**
- Modify: `frontend/src/pages/Dashboard/DashboardHome.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update main layout padding and background**

```tsx
// frontend/src/App.tsx
<main className="flex-1 ml-64 p-10 bg-slate-50 min-h-screen">
  <Outlet />
</main>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "ui: update main layout spacing and background"
```
