---
name: Tailwind v4 @apply with custom classes
description: Why @apply of a custom (non-utility) class fails in Tailwind v4 and how to compose styles instead.
---

In Tailwind v4 (this repo uses CSS-based `@theme`, no `tailwind.config`), `@apply`
only accepts **real utility classes**. Applying a custom class you defined
yourself (e.g. `.glass-card { @apply glass; }` where `.glass` is your own CSS
class) throws a build-time error: `Cannot apply unknown utility class 'glass'`.
This 500s the Vite dev server and renders a blank page.

**Why:** v4 resolves `@apply` against the utility registry only; author-defined
classes are not registered utilities.

**How to apply:** To share visual styles across custom classes, duplicate the raw
CSS declarations (or use CSS custom properties / a shared selector list), and only
use `@apply` for genuine Tailwind utilities (`p-3`, `flex`, `rounded-xl`, etc.).
You can mix raw CSS and `@apply` of real utilities in the same rule.
