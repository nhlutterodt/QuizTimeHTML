# Architectural Stability & Gap Analysis

## 🎯 Purpose
This document outlines the architectural standards, state management principles, and refactoring protocols designed to prevent regression, specifically addressing initialization race conditions and method loss during refactoring.

## 🏗️ Core Architectural Resolutions

### 1. State Management: Repository vs. Session
A critical distinction must be made between **Repository Data** (source of truth) and **Session Data** (ephemeral context).

*   **Repository State (`activeQuestions`)**: Represents the persistent collection of all available data (e.g., loaded from CSV/Database). This state is **immutable** during a quiz session.
*   **Session State (`questions`)**: Represents the subset of data active for the current user interaction (e.g., the 20 randomized questions in a quiz). This state is **derived** and **mutable**.

**❌ Anti-Pattern (The Failure Mode):**
Attempts to derive Session State directly during class initialization or reading from Session State before the derivation step has completed.
```javascript
// BAD
constructor() {
    this.questions = []; 
    // ...
    // Error: trying to filter 'this.questions' before it's populated from repository
    this.activeQuestions = this.questions.filter(...) 
}
```

**✅ Standard Pattern:**
Always initialize Session State explicitly from Repository State in a dedicated method (e.g., `startQuiz`), never in the constructor.
```javascript
// GOOD
getQuizQuestions(config) {
    // Always pull from Repository (activeQuestions)
    const source = this.activeQuestions || []; 
    return this.applyFilters(source);
}
```

### 2. Initialization Safety
*   **Async Initialization**: Services requiring async setup (e.g., DB loading) must have an `initialize()` method.
*   **Null Safety**: Arrays and objects typically populated async must be initialized to empty states (`[]`, `{}`) in the constructor, never `null` or `undefined`, to prevent `Cannot read properties of undefined` errors during early access.

## 🛡️ Refactoring Protocol

To prevent accidental method deletion (Regression):

1.  **Inventory First**: Before refactoring a class, list all public methods.
2.  **Incremental Change**: When changing architecture, add new methods *before* removing old ones.
3.  **Deprecation Phase**: If a method like `initializeManager` is being replaced, mark it `@deprecated` and forward calls to the new method for one commit cycle before removal.

## 🧩 Gap Analysis (Current Status)

| Architecture Component | Status | Resolution |
| :--- | :--- | :--- |
| **CSV Validation** | ✅ Resolved | Implemented flexible header normalization (Case-insensitive, Aliasing). Client-side now matches Server-side logic. |
| **Service State** | ✅ Resolved | `QuestionService` explicitly separates `activeQuestions` (Repo) and `questions` (Session). |
| **Error Handling** | ⚠️ Monitoring | startup logic now guarded with `try/catch` and default fallback states. |
| **Validation Logic** | ✅ Resolved | `ValidationHelpers` updated to support loose coupling with UI inputs. |

## 📜 Coding Standards (Addendum)

*   **Iterators**: Always use optional chaining `?.forEach` or default to empty array `(arr || []).forEach` when iterating over state that might be async loaded.
*   **Validation**: Validation logic should be shared or mirrored between Client and Server to prevent "valid on server, invalid on client" issues.
