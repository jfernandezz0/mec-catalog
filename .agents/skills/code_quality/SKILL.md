---
name: code-quality
description: TypeScript clean code, component modularity, and performance review.
---

# Code Quality Review Skill

This skill guides the Code Quality Reviewer in auditing and enforcing clean code, optimal database usage, and TypeScript safety in the MEC Catalog project.

## 1. Preventing N+1 Database Queries

In Next.js Server Components, check for loops or nested mapping operations that fire database requests on each iteration.

> [!WARNING]
> **Avoid mapping requests**:
> ```typescript
> // BAD: Querying database inside a map loop
> const articles = await supabase.from('articles').select('*');
> const articlesWithCategories = await Promise.all(
>   articles.map(async (art) => {
>     const { data: cat } = await supabase.from('categories').select('*').eq('id', art.category_id).single();
>     return { ...art, category: cat };
>   })
> );
> ```
>
> **Preferred Pattern (Joins or Batching)**:
> ```typescript
> // GOOD: Querying with Postgres relation joins in a single roundtrip
> const { data: articles } = await supabase
>   .from('articles')
>   .select('*, categories(*)');
> ```

## 2. TypeScript Guidelines
Ensure strict type enforcement across all files under `src/`:
- **No `any` Types**: Explicitly type inputs, outputs, states, and client parameters. Use generics or union types when needed.
- **Strict Null Checks**: Always handle cases where database returns null values or undefined props.
- **Strict Interface Definitions**: Ensure all Supabase database queries cast results to defined types or generate them using standard DB schema types.

## 3. Component Modularity & Design
- **Single Responsibility**: Keep client-side components focused on UI interactivity. Move data fetching or email generation services into separate, reusable files under `src/lib/`.
- **Reusable Utility Functions**: Centralize helpers under `src/lib/utils.ts` and `src/lib/utils.server.ts`.
- **UI Consistency**: Ensure all elements strictly adhere to Tailwind CSS v4 configurations and color schemes defined in `tailwind.config.ts`.
