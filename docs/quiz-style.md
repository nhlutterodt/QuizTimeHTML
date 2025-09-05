# Quiz App Stylesheet (`quiz-style.css`)

This stylesheet provides a modern, accessible, and user-friendly look for your quiz application. Reference it in your HTML with:

```html
<link rel="stylesheet" href="quiz-style.css">
```

---

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
.question:hover, .question:focus-within {
  background: #f0f8ff;
  box-shadow: 0 2px 8px rgba(118,199,192,0.15);
}

/* Options */
.options {
  list-style-type: none;
  padding: 0;
}
.options li {
  margin: 8px 0;
  padding: 6px 10px;
  border-radius: 4px;
  transition: background 0.15s;
}
.options li:hover, .options li:focus-within {
  background: #e6f6ea;
  cursor: pointer;
}

/* Buttons */
.btn {
  margin-top: 10px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #76c7c0;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not([disabled]) {
  background: #5bb3a9;
}
.btn[disabled] { opacity: 0.5; cursor: not-allowed; }

/* Result Block */
.result-block {
  margin-top: 12px;
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  padding: 10px;
  border-radius: 6px;
}
.result-block p { margin: 4px 0; }

/* Progress Bar */
.progress-container {
  width: 100%;
  background-color: #eee;
  margin: 12px 0;
  height: 20px;
  border-radius: 5px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background-color: #76c7c0;
  width: 100%;
  transition: width 1s linear;
}

/* Timer */
.timer { font-weight: bold; }

/* Misc */
#quiz-controls, #quiz-content, #retry-section { display: none; }
#question-counter { margin-bottom: 8px; font-weight: bold; }
#score { margin-top: 8px; font-weight: bold; }
#review-section { margin-top: 24px; display:none; }
.hr { height: 1px; background: #ececec; margin: 16px 0; }
.muted { color: #666; }

/* Summary Banner */
.summary-banner {
  display:none;
  padding: 12px 16px;
  border-radius: 8px;
  margin: 12px 0 20px 0;
  font-weight: 600;
}
.summary-banner.pass { background: #e6f6ea; border: 1px solid #b7e2c0; }
.summary-banner.fail { background: #fdeaea; border: 1px solid #f3c0c0; }
.summary-banner .sub { font-weight: normal; display:block; margin-top: 6px; }

/* Tooltip for question hover (optional) */
.tooltip {
  display: inline-block;
  background: #222;
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.95em;
  margin-left: 8px;
  position: absolute;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.question:hover .tooltip, .question:focus-within .tooltip {
  opacity: 1;
}
```

---

**How to use:**
1. Save this file as `quiz-style.css` in your project folder.
2. In your HTML `<head>`, replace the `<style>...</style>` block with:
   ```html
   <link rel="stylesheet" href="quiz-style.css">
   ```
3. Remove the old inline `<style>` block from your HTML.
