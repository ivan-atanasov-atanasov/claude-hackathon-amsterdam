---
name: deploy
description: Deploy frontend and backend
disable-model-invocation: true
---
Deploy the current state of the project:

1. Run frontend tests: cd frontend && npm test -- --watchAll=false
2. Run backend tests: cd backend && source venv/bin/activate && pytest tests/
3. If all pass, deploy frontend: vercel --prod from repo root
4. Push to main to trigger Railway backend deploy
5. Verify both deployments are healthy
