# GitHub Push Guide

This repository should not push generated folders, dependencies, local secrets, or AI model weights.

## Files to Push

Push source code and documentation:

- `src/`
- `server/`
- `detector.py`
- `docs/`
- `.github/`
- `docker/`
- `public/`
- `assets/`
- `package.json`
- `package-lock.json`
- `server/package.json`
- `server/package-lock.json`
- `README.md`
- `.env.example`
- `server/.env.example`
- `detector.env.example`

## Files Not to Push

These are ignored:

- `node_modules/`
- `server/node_modules/`
- `dist/`
- `__pycache__/`
- `.env`
- `.venv/`
- `*.pt` YOLO model weights
- video files

## First Push Commands

```bash
git init
git add .
git commit -m "Initial Guardian Vision release"
git branch -M main
git remote add origin https://github.com/<your-username>/Guardian-Vision.git
git push -u origin main
```

## If Push Fails Because of Large Files

Check large tracked files:

```bash
git ls-files
```

If a large file is staged but not committed:

```bash
git rm --cached path/to/file
git commit -m "Remove generated files from repository"
```

If a large file was already committed, the cleanest beginner-friendly fix is:

1. Create a fresh GitHub repository.
2. Make sure `.gitignore` is updated.
3. Delete the local `.git` folder only if you are sure you do not need the old history.
4. Run the first push commands again.

For production repositories with important history, use `git filter-repo` or BFG Repo-Cleaner instead of deleting history.
