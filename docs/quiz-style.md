# Quiz App Styles (canonical)

This project uses modular styles. Use the canonical stylesheet for shared utilities and component styles instead of duplicating CSS.

- Shared utilities (buttons, small helpers, variables): `src/style/shared.css`
- Quiz layout and progress visuals: `src/style/quiz.css`
- Dialogs: `src/style/dialogs.css`
- Upload UI: `src/style/upload.css`
- Schema preview: `src/style/schema.css`

Example (layout and small helpers only — button styles are centralized):

```css
/* General Layout */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
  max-width: 900px;
  margin: auto;
}
h1 { margin-top: 0; }

/* Question Card */
.question {
  margin-bottom: 20px;
  display: none;
  background: #fff;
  border-radius: 8px;
  transition: box-shadow 0.2s, background 0.2s;
}
.question.active { display: block; }

/* Note: button rules are defined in `src/style/shared.css`.
   Do not duplicate `.btn` in your HTML or other stylesheets. */
```

---

How to use:

1. Include the canonical styles in your HTML `<head>`:

```html
<link rel="stylesheet" href="src/style/shared.css">
<link rel="stylesheet" href="src/style/quiz.css">
```

2. Remove any duplicated button styles from inline `<style>` blocks or backup files and use the `.btn`, `.btn-primary`, etc. classes from `src/style/shared.css`.

3. If you need to override button appearance for a specific component, scope the rule (e.g. `.supplementation-dialog .btn`) and keep overrides minimal.
