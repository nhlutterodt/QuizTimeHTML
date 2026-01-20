# UI Standards & Guidelines

## Overview
This document outlines the standard user interface patterns, CSS conventions, and testing attributes used in the QuizTimeHTML application. Adhering to these standards ensures consistency, maintainability, and testability across the project.

## 1. CSS Architecture

### Global Box Sizing
The project uses a global `box-sizing: border-box` reset to ensure predictable element sizing:
```css
* {
  box-sizing: border-box;
}
```
*Do not override this unless absolutely necessary for a specific third-party integration.*

### CSS Variables (Theme)
We use CSS variables for theme consistency. These are defined in `src/style/quiz.css`.

| Variable | Description | Standard Value |
|----------|-------------|----------------|
| `--quiz-bg` | Main background color | `#f8f9fa` |
| `--card-bg` | Card background | `#ffffff` |
| `--text-primary` | Primary text color | `#2d3748` |
| `--text-secondary` | Secondary/Meta text color | `#718096` |
| `--accent-color` | Brand accent (Buttons/Highlights) | `#667eea` |
| `--radius-lg` | Large border radius (Cards/Modals) | `12px` |
| `--radius-md` | Medium border radius (Inputs/Buttons) | `8px` |

### Layout Systems
- **Cards**: Use `.config-section` or `.question-card` for container elements. They automatically apply the standard background, shadow, and border radius.
- **Grids**: The configuration panel uses `display: grid` with `auto-fit` columns for responsiveness.
  ```css
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  ```
- **Panel Layout**: The main configuration panel uses a strict flex/column layout to ensure the header and footer remain sticky while the content scrolls.

## 2. Component ID System (`data-element-id`)

To facilitate automated testing and reliable DOM querying, we enforce a `data-element-id` convention for all interactive elements and significant containers.

### Format
`config-{type}-{name}`

- **type**: The type of element (e.g., `btn`, `input`, `select`, `section`, `checkbox`).
- **name**: A descriptive, unique name for the element.

### Examples
- **Buttons**: `data-element-id="config-btn-save"`
- **Inputs**: `data-element-id="config-input-exam-time"`
- **Sections**: `data-element-id="config-section-timer"`
- **Toggles**: `data-element-id="config-toggle-multi-upload"`

### Usage Rule
**ALWAYS** add a `data-element-id` attribute when creating new interactive elements in the `ConfigurationPanel` or other core components. This ID should remain stable even if the CSS class or hierarchy changes.

## 3. Form Elements

### Styles
All form inputs should use the `.form-control` class.
- **Inputs**: standard padding `0.75rem 1rem`.
- **Selects**: custom SVG chevron background.
- **Focus States**: strict focus ring using the brand accent color (`--accent-color`).

### Validation
- **Real-time**: Attach simple event listeners (e.g., `input`, `blur`) to provide immediate feedback.
- **Error States**: Toggle the `.error` class on the input and append a `.field-error` message element.

## 4. Typography
- **Headings**: Use `h2` for panel titles, `h3` for section headers.
- **Body**: standard sans-serif stack.
- **Code**: `Consolas`, `Monaco`, monospace for code blocks.
