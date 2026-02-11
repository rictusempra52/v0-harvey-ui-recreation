# create-component Skill

## When to use
- When creating a new UI component in Next.js/React.

## Checklist
- [ ] **Props Definition**: Define a clear `interface` for props.
- [ ] **Component Implementation**:
    - Use `React.FC` or standard function declaration with return type.
    - Ensure it is a Client Component (`"use client"`) if it uses hooks.
- [ ] **Styling**: Use Tailwind CSS utilities. Avoid arbitrary values (`w-[123px]`) if possible; use theme tokens.
- [ ] **Accessibility & Elderly Friendly**:
    - **Font Size**: Use large, readable fonts (at least `text-base`, preferably `text-lg` for labels).
    - **Contrast**: Ensure high color contrast for readability.
    - **Click Targets**: Ensure buttons and links have large clickable areas (min 44x44px).
    - **Radix UI**: Use Radix UI primitives for complex interactive elements.
- [ ] **Export**: Export the component from the file (default or named).
