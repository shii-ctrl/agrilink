# Source structure

AgriLink is one full-stack TanStack Start application. The browser interface and
server functions are deployed together, so this structure keeps one reliable
deployment while separating responsibilities clearly.

| Folder | Purpose |
| --- | --- |
| `routes/` | URL entry points. These remain flat because TanStack generates routes from file names. |
| `features/` | Business features and their feature-specific UI: authentication, marketplace, messaging, and operations. |
| `services/` | Protected server functions, grouped by authentication, marketplace, messaging, and operations. |
| `components/` | Reusable application UI: shared layouts, workspace shells, data controls, and the generated UI kit. |
| `db/` | Database connection, schema, and development seed data. |
| `hooks/` | Shared React hooks. |
| `lib/` | Small shared helpers, error handling, and prototype/demo helpers. |
| `assets/` | Static images used by the application. |

## Adding a feature

1. Add its UI and browser helpers under `features/<feature>/`.
2. Add protected database work under `services/<feature>/`.
3. Add or update a file in `routes/` only when a new URL is needed.
4. Keep reusable visual primitives in `components/ui/`.

Do not rename or move route files solely for organisation: their file names are
part of the public URLs. `routeTree.gen.ts` is generated automatically and must
not be edited manually.
