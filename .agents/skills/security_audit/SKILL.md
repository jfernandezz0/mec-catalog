---
name: security-audit
description: Audits Supabase PostgreSQL schemas, RLS policies, and endpoint security.
---

# Supabase PostgreSQL Security Audit Skill

This skill guides the Security Auditor in performing comprehensive checks on database policies, schemas, and public API safety.

## 1. Verifying Row Level Security (RLS)

Use the `supabase-postgres` MCP server to run queries against `pg_tables` and `pg_policies` to verify that RLS is active on all tables.

### SQL to check RLS status on all user tables:
```sql
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM 
    pg_tables 
WHERE 
    schemaname = 'public';
```
> [!IMPORTANT]
> If any critical table (like `orders`, `discounts`, `settings`, `cart_sessions`) shows `rowsecurity = false`, raise a **CRITICAL WARNING** to the user.

### SQL to retrieve all RLS policies:
```sql
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM 
    pg_policies 
WHERE 
    schemaname = 'public';
```

## 2. Security Assessment Criteria

Review the output of your database checks against the following criteria:
- **No Wildcard Rules**: Tables containing sensitive data must not have a policy permitting `ALL` operations to `anon` or public roles without authentication checks (e.g. `auth.role() = 'authenticated'`).
- **Write Policy Restrictions**: Only authenticated administrators or server-side admin clients (using `service_role` key) should be allowed to write/edit the `articles`, `discounts`, and `settings` tables.
- **Order Protection**: Check that the `orders` table has RLS policies ensuring users can only read their own order histories based on user ID or safe secure identifiers.
