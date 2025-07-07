# Agent Guidelines for Klyro

This document outlines the conventions and commands for agents working on this repository.

## 1. Build/Lint/Test Commands

- **Install Dependencies**: `npm install`
- **Build**: `npm run setup` (installs dependencies and converts icons)
- **Lint**: No dedicated linting command found. Adhere to existing code style.
- **Test**: No automated tests or test commands found. Manual testing is required.

## 2. Code Style Guidelines

- **Language**: JavaScript (ES6+), HTML, CSS.
- **Formatting**:
    - Indentation: 2 spaces (inferred).
    - Semicolons: Use at the end of statements.
- **Naming Conventions**:
    - Variables and Functions: `camelCase` (e.g., `loadSettings`, `summarizePost`).
    - Classes: `PascalCase` (e.g., `AIProvider`, `OpenAIProvider`).
    - Constants: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_SETTINGS`, `BUTTON_CLASS`).
- **Error Handling**:
    - Use `try...catch` for asynchronous operations and API calls.
    - Provide informative error messages to the user where applicable.
- **Imports**: Standard ES module imports are not used. Chrome extension specific `chrome.runtime.getURL` is used for script injection.
- **Types**: No explicit type system (e.g., TypeScript) is used.
- **Comments**: Use comments for complex logic or explanations where necessary.

## 3. Cursor/Copilot Rules

No specific Cursor rules (`.cursor/rules/`) or Copilot instructions (`.github/copilot-instructions.md`) were found in this repository.