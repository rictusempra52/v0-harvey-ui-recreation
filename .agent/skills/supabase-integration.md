# supabase-integration Skill

## When to use
- When interacting with Supabase (Database, Storage, Auth, Edge Functions).
- When defining or updating database types.

## Guidelines
### 1. Database & Types
- **Type Safety**: Always use generated types. Refer to `lib/database.types.ts`.
- **Querying**: Use the Supabase client correctly. Prefer specific column selection over `*` for performance.
- **Error Handling**: Always check for `error` in Supabase responses and handle them appropriately.

### 2. Storage
- **Uploads**: Use the standard upload pattern. Ensure file size and type validation on the client side.
- **Public URLs**: Be mindful of bucket permissions (public vs private).

### 3. Edge Functions
- **Deployment**: Ensure environment variables are correctly set.
- **Communication**: Use JSON for request and response bodies.
