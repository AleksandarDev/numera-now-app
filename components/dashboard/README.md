# Dashboard Widgets System

This directory contains the customizable dashboard widget system implementation using `@dnd-kit` for drag-and-drop functionality.

## Architecture

### Components

- **DashboardGrid** - Main container that provides drag-and-drop context using `@dnd-kit`
- **DraggableWidget** - Wrapper component for each widget with drag handle and controls
- **WidgetConfigDialog** - Modal for configuring widget settings
- **WidgetStoreButton** - Button to open widget store and add new widgets
- **DashboardControls** - Control bar with add widget and reset layout buttons

### Widget System

- **Widget Registry** (`lib/widgets/registry.ts`) - Central registry of all official widgets
- **Widget Types** (`lib/widgets/types.ts`) - TypeScript definitions for widgets and configurations
- **Widget Store** (`lib/widgets/store.ts`) - Zustand store for state management with localStorage persistence

### Official Widgets

1. **Financial Summary (data-grid)** - Displays balance, income, and expenses cards
   - Configuration: refresh rate, show/hide individual cards
   
2. **Analytics Charts (data-charts)** - Shows line chart and spending pie chart
   - Configuration: refresh rate, default chart types

## Features

- ✅ Drag-and-drop widget reordering with `@dnd-kit`
- ✅ Add/remove widgets
- ✅ Configure widget settings
- ✅ Persistent layout using localStorage
- ✅ Reset to default layout
- ✅ Keyboard and pointer sensor support
- ✅ Official widgets only (no custom/community widgets)

## Usage

The dashboard automatically renders widgets from the store. Users can:

1. **Drag & Drop**: Hover over a widget and use the grip handle to drag it to a new position
2. **Configure**: Click the settings icon on a widget to open configuration
3. **Remove**: Click the trash icon to remove a widget
4. **Add**: Click "Add Widget" button to browse and add official widgets
5. **Reset**: Click "Reset Layout" to restore the default dashboard

## Future Extensibility

The system is designed for easy extension:

- Add new widget types by registering them in `lib/widgets/registry.ts`
- Create new widget components in `components/widgets/`
- Define configuration schemas for custom settings
- Widget permissions can be added to the type definitions

## Technical Details

- **State Management**: Zustand with localStorage persistence
- **Drag & Drop**: @dnd-kit with vertical list sorting strategy
- **Styling**: Tailwind CSS matching existing dashboard design
- **Type Safety**: Full TypeScript support with discriminated unions
