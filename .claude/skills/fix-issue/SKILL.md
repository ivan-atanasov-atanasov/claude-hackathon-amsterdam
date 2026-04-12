---
name: fix-issue
description: Fix a GitHub issue end to end
disable-model-invocation: true
---
Fix GitHub issue: $ARGUMENTS

1. Use gh issue view to read the issue
2. Find relevant files in the codebase
3. Implement the fix
4. Write a test that verifies the fix
5. Run tests and ensure they pass
6. Commit and open a PR referencing the issue
