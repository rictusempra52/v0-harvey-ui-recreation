# create-component Skill

## When to use
- When creating a new UI component in Next.js/React.

## Checklist
- [ ] **Props Definition**: Define a clear `interface` for props.
- [ ] **Component Implementation**:
    - Use `React.FC` or standard function declaration with return type.
    - Ensure it is a Client Component (`"use client"`) if it uses hooks.
- [ ] **Styling**: Use Tailwind CSS utilities. Avoid arbitrary values (`w-[123px]`) if possible; use theme tokens.
- [ ] **Accessibility**: Use semantic HTML or Radix UI primitives for interactive elements.
- [ ] **Export**: Export the component from the file (default or named).
