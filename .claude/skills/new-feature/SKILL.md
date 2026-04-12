---
name: new-feature
description: Build a new feature end to end
disable-model-invocation: true
---
Build the feature: $ARGUMENTS

1. Read docs/PRD.md and docs/api-spec.yaml for context
2. Add FastAPI endpoint in backend/main.py
3. Add Supabase query
4. Add TypeScript API call in frontend/lib/api.ts
5. Build React component with loading and error states
6. Write a minimal pytest test for the endpoint
7. Commit with descriptive message and open a PR
