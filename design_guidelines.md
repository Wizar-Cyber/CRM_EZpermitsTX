# CRM Application Design Guidelines

## Design Approach
**Reference-Based Approach**: Modern SaaS CRM with influences from Linear (clean typography, purposeful spacing), Notion (card-based layouts), and traditional CRM tools (data-dense, functional).

## Brand Identity

### Logo & Visual Identity
- Use provided logo as primary branding element
- Logo placement: Top-left of sidebar, header on collapsed state
- Brand reflects professional, efficiency-focused CRM tool

### Color Palette

**Primary Colors:**
- Primary: `#0E3A5E` (214 71% 22%) - Deep navy blue for headers, primary actions, active states
- Accent: `#E8412D` (6 79% 55%) - Vibrant red from "EZ" logo for CTAs, important actions, alerts

**Semantic Colors (Tailwind):**
- Success: `emerald-500` for completed/green status leads
- Warning: `amber-500` for yellow status leads, warnings
- Error: `rose-500` for red status leads, critical actions
- Neutral: `slate-50` through `slate-900` for backgrounds, borders, text

**Lead Status Colors:**
- GREEN status: `emerald-500` backgrounds, `emerald-700` text
- YELLOW status: `amber-500` backgrounds, `amber-700` text
- RED status: `rose-500` backgrounds, `rose-700` text
- Default/Other: `slate-500` backgrounds, `slate-700` text

## Typography

**Font Families:**
- Primary: Inter (Google Fonts)
- Alternative: Nunito (Google Fonts)
- Use single family throughout for consistency

**Type Scale:**
- Display headings: `text-3xl` to `text-4xl`, `font-bold`
- Section headings: `text-2xl`, `font-semibold`
- Card titles: `text-lg`, `font-medium`
- Body text: `text-base`, `font-normal`
- Secondary text: `text-sm`, `text-slate-600`
- Captions/metadata: `text-xs`, `text-slate-500`

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 4, 6, 8, 12, 16** for consistent rhythm
- Micro spacing: `p-2`, `gap-2`
- Standard spacing: `p-4`, `m-4`, `gap-4`
- Section spacing: `p-6`, `p-8`
- Large spacing: `p-12`, `p-16`

### Layout Structure

**Sidebar:**
- Collapsible design (expanded: 240px, collapsed: 64px)
- Background: `bg-slate-50` light mode, `bg-slate-900` dark mode
- Active nav item: `bg-primary` with `text-white`
- Hover states: `bg-slate-100` light, `bg-slate-800` dark
- Icons from Lucide or Heroicons (consistent set)

**Header:**
- Height: `h-16`
- Contains: Logo (when sidebar collapsed), page title, user profile mini-avatar
- Background: `bg-white` with `border-b border-slate-200`
- Profile dropdown: Top-right corner

**Content Area:**
- Max width: `max-w-7xl` for wide layouts, `max-w-6xl` for standard
- Padding: `p-6` to `p-8`
- Background: `bg-slate-50` for contrast against white cards

## Component Library

### Cards
- Border radius: `rounded-2xl` (all cards)
- Shadow: `shadow-sm` default, `shadow-md` on hover, `shadow-lg` for modals
- Padding: `p-6` for content
- Background: `bg-white`
- Border: Optional `border border-slate-200` for definition

### Buttons
- Border radius: `rounded-2xl`
- Padding: `px-6 py-3` for primary, `px-4 py-2` for secondary
- Focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`

**Primary Button:**
- Background: `bg-primary`, `hover:bg-primary/90`, `active:bg-primary/80`
- Text: `text-white`, `font-medium`

**Accent Button:**
- Background: `bg-accent`, `hover:bg-accent/90`
- Text: `text-white`, `font-medium`

**Secondary Button:**
- Background: `bg-slate-200`, `hover:bg-slate-300`
- Text: `text-slate-700`, `font-medium`

**Icon Buttons (table actions):**
- Size: `w-8 h-8`, `rounded-lg`
- Background: transparent, `hover:bg-slate-100`
- Icons: 👁 (view), ✅ (schedule), 🗺️ (send to map)

### Tables
- Header: `bg-slate-50`, `text-slate-700`, `font-semibold`, `text-sm`
- Rows: `bg-white`, alternating `bg-slate-50/50`
- Hover: `hover:bg-slate-100`
- Selected: `bg-primary/10` with `border-l-4 border-primary`
- Cell padding: `px-4 py-3`
- Sortable headers: Arrow icon, `cursor-pointer`

### Modals
- Backdrop: `bg-black/50` with backdrop blur
- Container: `bg-white`, `rounded-2xl`, `shadow-2xl`
- Max width: `max-w-2xl` for standard, `max-w-4xl` for complex
- Padding: `p-6` to `p-8`
- Tabs (if present): Underline style, `border-b-2 border-primary` for active

### Forms
- Input fields: `rounded-lg`, `border border-slate-300`, `px-4 py-2.5`
- Focus: `focus:border-primary focus:ring-2 focus:ring-primary/20`
- Labels: `text-sm font-medium text-slate-700`, `mb-2`
- Helper text: `text-xs text-slate-500`

### Map Components
- Marker colors match lead status colors
- Popup: White background, `rounded-lg`, `shadow-lg`, `p-3`
- Route polyline: `stroke-primary`, `stroke-width: 3`, `opacity: 0.8`
- Address list sidebar: `bg-white`, `rounded-xl`, `shadow-md`, `p-4`

### Dashboard Cards
- Large metrics: `text-4xl font-bold text-slate-900`
- Icons: `w-12 h-12` with subtle background circle in brand colors
- Trend indicators: Small arrows with percentage change
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`

### Calendar (Appointments)
- Toolbar: `bg-slate-50`, `rounded-lg`, `p-3`
- Events: `rounded-md` with status-based colors
- Today highlight: `border-2 border-primary`
- Time slots: `border-slate-200`

## Interactive States

### Hover States
- Buttons: Slight darkening (-10% opacity or darker shade)
- Cards: Subtle elevation increase (`shadow-md`)
- Table rows: `bg-slate-100`
- Nav items: `bg-slate-100` light, `bg-slate-800` dark

### Active/Focus States
- Ring: `ring-2 ring-offset-2 ring-primary` for keyboard focus
- Active button: Slight scale down `active:scale-95` (subtle)
- Selected items: `bg-primary/10` with left border accent

### Loading States
- Skeleton screens: `animate-pulse bg-slate-200 rounded-lg`
- Spinners: Primary color, centered
- Disabled: `opacity-50 cursor-not-allowed`

## Accessibility

**Dark Mode (Phase 4):**
- Implement `dark:` variants for all components
- Use `slate-900` for dark backgrounds, `slate-100` for dark text
- Maintain contrast ratios (WCAG AA minimum)
- Store preference in `localStorage.theme`
- Toggle in header (moon/sun icon)

**Keyboard Navigation:**
- All interactive elements tabbable
- Focus indicators clearly visible
- Modal trap focus within dialog
- Escape key closes modals

## Page-Specific Guidelines

### Dashboard
- Hero metrics: 4 large cards with icons
- Chart: Full-width card below metrics, `rounded-2xl`, Recharts bar/pie chart
- Color coding: Match lead status colors in visualizations

### Leads Page
- Table-centric layout, no map embed
- Multi-select checkboxes: `w-4 h-4 rounded`
- Action buttons: Icon + tooltip on hover
- Status pills: `px-3 py-1 rounded-full text-xs font-medium`

### Map Page
- Split layout: Address list (300px sidebar) + map
- Controls: Floating bottom-right, `bg-white rounded-xl shadow-lg p-3`
- Save route button: Prominent, accent color

### Routes Page
- Table with Edit/Delete actions
- Edit icon: `pencil`, Delete icon: `trash` with confirmation modal

### Appointments Page
- Calendar takes center stage, full height
- Toolbar: Date picker, view switcher (month/week/day)
- Event creation: Modal with form, pre-filled from lead context

## Animations
Use sparingly, only for feedback:
- Button clicks: `active:scale-95` (subtle)
- Toast notifications: Slide in from top-right
- Modal enter/exit: Fade + scale from center
- Sidebar collapse: Smooth width transition `transition-all duration-300`
- **No** scroll-triggered animations or excessive motion

## Icons
- Library: Lucide React (consistent, modern)
- Size: `w-5 h-5` for buttons, `w-6 h-6` for nav, `w-8 h-8` to `w-12 h-12` for dashboard
- Color: Inherit from parent or explicit utility classes

## Images
**Logo Only:** Use provided brand logo in header/sidebar
**No Hero Images:** This is a utility-focused CRM tool, not marketing
**Map Imagery:** Leaflet tiles (OpenStreetMap) for geographical context
**Avatars:** User profile pictures (circular, `w-8 h-8` to `w-10 h-10`)