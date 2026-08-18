# Grid-Weather-Reporter project instructions

## Project scope
This repository contains a small Electron app for weather reporting by grid coordinates or city/state input. Keep changes focused on reliability, usability, and the existing app structure.

## Workflow expectations
- Prefer small, reviewable changes over broad refactors.
- Keep the app behavior consistent with the current project design and naming.
- Update tests when behavior changes.
- Run the relevant validation command before claiming the work is complete.

## GitHub and repository workflow
- Check git status before making changes, especially when preparing a sync or commit.
- Keep commit messages descriptive and specific to the task.
- Do not force-push or overwrite remote work without explicit approval.
- When syncing with GitHub, fetch first, review branch state, then commit and push the intended branch.
- For user-facing work, prefer a clean branch-based workflow and create a pull request when the change is ready for review.

## Validation
- Use npm test for the project test suite.
- If the app behavior is changed, verify the likely runtime path and mention any unverified areas clearly.

## Safe defaults
- Preserve the current README, app structure, and project configuration unless the user explicitly asks for a change.
- Avoid unrelated dependency churn or configuration edits.
- If a task involves GitHub sync, explain the branch state and any blockers before taking destructive actions.
