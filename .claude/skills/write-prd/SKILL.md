---
name: write-prd
description: Interactive PRD creation through guided discovery
disable-model-invocation: true
---
Create a PRD for: $ARGUMENTS

Interview the user to gather requirements. Ask targeted questions across:
1. Problem statement — what pain are we solving and for who?
2. Target users — who specifically, what are their constraints?
3. Core features — MVP only, what are the 3-5 must-haves?
4. User flows — walk through the key interactions step by step
5. Technical constraints — stack, integrations, time limit (24 hours)
6. Success criteria — how will we know it works at the demo?
7. Out of scope — what are we explicitly NOT building?

Keep asking until you have enough detail to write a complete PRD.
Then save it to docs/PRD.md AND .taskmaster/docs/prd.txt with these sections:
- Overview
- Problem Statement
- Target Users
- MVP Features (prioritized)
- User Stories
- Technical Requirements
- API Endpoints needed
- Database schema
- Out of Scope
- Success Criteria
