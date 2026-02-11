# ui-design-rules Skill

## When to use
- When designing or modifying user interfaces.
- When evaluating the UX for elderly users.

## Guidelines
### 1. Readability (読みやすさ)
- **Font Size**: Use `text-base` (16px) as the absolute minimum. Important information and interactive elements should be `text-lg` (18px) or larger.
- **Line Height**: Use `leading-relaxed` or `leading-loose` to provide enough space between lines.
- **Contrast**: Ensure text colors have high contrast against backgrounds (WCAG AA standard at minimum).

### 2. Interaction (操作性)
- **Click Targets**: Buttons and interactive areas should be at least 44x44px. Avoid placing small buttons close together.
- **Visual Feedback**: Provide clear hover and active states. Use distinct colors/shadows to indicate interactivity.
- **Simplicity**: Avoid complex gestures (long press, double click). Single click/tap should be the primary interaction.

### 3. Layout (レイアウト)
- **Responsive**: Design for both PC and Mobile. Ensure larger elements on mobile to accommodate touch.
- **Visual Hierarchy**: Use clear headings and grouping (e.g., using cards with subtle shadows) to organize information.

### 4. Messaging (メッセージング)
- **Language**: Use polite and simple Japanese. Avoid technical jargon or complex English terms.
- **Status Indication**: Use clear, large badges for statuses (e.g., "完了", "エラー").
