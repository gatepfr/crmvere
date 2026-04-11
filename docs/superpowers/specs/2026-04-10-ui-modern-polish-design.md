# Design Spec: UI/UX Modern Polish (VereadorCRM)

**Data:** 2026-04-10
**Estilo Escolhido:** Opção A (Inter + Slate)
**Objetivo:** Refinar as fontes, espaçamentos e acabamento visual do Dashboard para um padrão premium.

## 1. Identidade Visual (UI)

### Tipografia
- **Fonte Principal:** [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts).
- **Pesos:** 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold).
- **Tamanhos:**
    - Títulos: 24px - 32px (Bold).
    - Subtítulos: 14px (Slate-500).
    - Corpo de texto: 16px (Slate-800).

### Cores (Slate + Blue Palette)
- **Fundo Global:** `bg-slate-50` (#f8fafc).
- **Sidebar:** `bg-slate-900` (#0f172a).
- **Cards:** `bg-white` com borda `border-slate-200` (#e2e8f0).
- **Destaque (Ação):** `bg-blue-600` (#2563eb).

---

## 2. Refinamentos de Layout

### Sidebar
- **Ícones:** Tamanho padronizado (20px) usando Lucide React.
- **Estados de Hover:** Fundo `bg-slate-800` e texto `text-white`.
- **Active State:** Fundo `bg-blue-600` e ícone destacado.

### Cards e Espaçamento
- **Paddings:** Aumentar o espaçamento interno para pelo menos `p-6` (24px) para maior respiro.
- **Gaps:** Usar `gap-6` em grids para separar melhor as informações.
- **Arredondamento:** Padronizar para `rounded-xl` (12px).

### Tipografia Detalhada
- Substituir todas as fontes padrão por **Inter**.
- Uso de `tracking-tight` em títulos para um visual mais moderno.

---

## 3. Melhorias nas Páginas de Configuração

### Configuração IA
- Organização em Grid 2 colunas para campos menores (Chave API, Modelo).
- Campo de Texto (Prompt) com altura generosa e bordas suaves.

### Feedback Visual
- Animações suaves de transição entre as páginas.
- Uso de `transition-all` em botões e inputs.

---

## 4. Critérios de Sucesso
- O sistema carrega a fonte Inter do Google Fonts.
- O visual é limpo, com bom contraste e respiro.
- A navegação lateral parece fluida e moderna.
