#!/bin/sh

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -B production
git add .
git commit -m "Automated push to production"
git push origin production --force-with-lease