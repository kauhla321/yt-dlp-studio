---
name: Studio Precision
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#e3bdbf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#aa888a'
  outline-variant: '#5b4041'
  surface-tint: '#ffb2b7'
  primary: '#ffb2b7'
  on-primary: '#67001b'
  primary-container: '#ff516a'
  on-primary-container: '#5b0017'
  inverse-primary: '#bc0b3b'
  secondary: '#44e2cd'
  on-secondary: '#003731'
  secondary-container: '#03c6b2'
  on-secondary-container: '#004d44'
  tertiary: '#b7c8e1'
  on-tertiary: '#213145'
  tertiary-container: '#8292aa'
  on-tertiary-container: '#1a2b3e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdadb'
  primary-fixed-dim: '#ffb2b7'
  on-primary-fixed: '#40000d'
  on-primary-fixed-variant: '#92002a'
  secondary-fixed: '#62fae3'
  secondary-fixed-dim: '#3cddc7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-base:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-dense:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-spec:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  sidebar-width: 260px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is engineered for high-performance media management, blending technical precision with a sophisticated, professional aesthetic. The personality is "expert-tier utility"—it prioritizes clarity and data density without sacrificing visual elegance.

The visual style is a fusion of **Glassmorphism** and **Modern Corporate** aesthetics. By utilizing translucent layers, subtle backdrop blurs, and high-contrast accents, the UI maintains a sense of depth and hierarchy essential for complex media workflows. The goal is to evoke a sense of "Desktop-Class" reliability, making the user feel they are operating a powerful, precise instrument rather than a casual web tool.

## Colors

The design system employs a deep, dark-mode-first palette to reduce eye strain during long sessions and to allow media thumbnails to stand out.

- **Primary (Salmon-pink):** Reserved for high-priority actions, primary branding elements, and active states that require immediate focus.
- **Secondary (Teal-green):** Used for system health, success states, download indicators, and metadata validation.
- **Neutrals:** A range of Slate and Charcoal tones. The base background is a rich `#0F172A`, with surfaces stepping up in lightness to define hierarchy.
- **Contrast:** High-contrast white (`#F8FAFC`) is used for primary text, while muted slate is used for secondary metadata to manage information density.

## Typography

This design system relies on **Inter** for its exceptional legibility in technical interfaces. It utilizes a tight, modern scale to accommodate high-density information displays.

- **Headlines:** Use bold weights and slight negative letter-spacing for a modern, "engineered" look.
- **Technical Specs:** Where file paths, bitrates, or CLI arguments are displayed, a secondary monospaced font (JetBrains Mono) should be used to differentiate raw data from UI labels.
- **Hierarchy:** Use font weight and color (white vs. slate-400) more aggressively than font size to establish hierarchy in dense metadata cards.

## Layout & Spacing

The design system follows an **8px grid system**, ensuring consistent alignment across all utility panels.

- **Layout Model:** A fixed-width left sidebar (260px) for global navigation, with a fluid content area that expands to a maximum of 1440px.
- **Grid:** In the main content area, use a 12-column grid for format selection and library lists.
- **Density:** Use "Compact" vertical spacing (8px or 12px) for list items and metadata rows, but "Comfortable" spacing (32px+) for section transitions to avoid visual clutter.
- **Desktop Focus:** While the layout is responsive, priority is given to desktop-specific interactions like hover states, context menus, and multi-pane views.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Glassmorphism** rather than traditional heavy shadows.

- **Base Layer:** The deep neutral background (`#0F172A`).
- **Surface Layer:** Cards and panels use a subtle background blur (20px) with a semi-transparent fill (`rgba(30, 41, 59, 0.7)`).
- **Borders:** Every surface is defined by a 1px "inner-glow" border. Use a high-contrast white-alpha (`rgba(255, 255, 255, 0.1)`) for top/left edges and a darker-alpha for bottom/right to simulate a physical, machined edge.
- **Overlays:** Modals and tooltips use a higher blur (40px) and a slightly darker backdrop to pull focus.

## Shapes

The shape language is "Soft-Technical." Elements use a base `0.5rem` (8px) radius to feel modern and approachable, while remaining structured enough for a utility app.

- **Small Components:** Checkboxes, tags, and small buttons use a 4px (Soft) radius.
- **Standard Components:** Format cards, input fields, and standard buttons use 8px (Rounded).
- **Containers:** Settings panels and the main sidebar use 12px or 16px (Rounded-LG) to frame the application.

## Components

### Side Navigation
Nav items feature a "ghost" background on hover. The active state is indicated by a 3px salmon-pink vertical bar on the left edge and the icon/text color switching to primary pink.

### URL Input & Analyze
A wide, dark input field with a subtle inner shadow. The "Analyze" button is integrated into the right side of the input field as a high-contrast salmon-pink action button with a springy scale-down effect on click.

### Format Selection Cards
Detailed cards displaying resolution, codec, and file size. Use Teal-green for the "best quality" badge. Metadata should be aligned in a grid within the card using the `mono-spec` typography for file sizes and bitrates.

### Progress Bars
The track is a dark slate-800. The progress fill is a Teal-green gradient. Above the bar, display a three-column data row: [Status Text] [Download Speed] [ETA], all using the `mono-spec` font for technical alignment.

### Toggle Switches
Small, tactile switches. When "On," the track becomes Salmon-pink. The "thumb" should have a subtle 1px border to make it pop against the vibrant track.

### Library/History List Items
Row-based items with a hover-state that reveals a "Quick Action" toolbar (Play, Folder, Delete). The background should subtly lighten on hover to `rgba(255, 255, 255, 0.05)`.