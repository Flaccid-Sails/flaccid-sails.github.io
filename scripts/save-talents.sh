#!/usr/bin/env bash
set -euo pipefail
index_file=$(mktemp)
trap 'rm -f "$index_file"' EXIT
rm "$index_file"
export GIT_INDEX_FILE="$index_file"
export GIT_AUTHOR_NAME='github-actions[bot]'
export GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
parent=$(git rev-parse HEAD)
git read-tree "$parent"
blob=$(git hash-object -w data/talents.json)
git update-index --add --cacheinfo "100644,$blob,data/talents.json"
while IFS= read -r -d '' file; do
  blob=$(git hash-object -w "$file")
  git update-index --add --cacheinfo "100644,$blob,$file"
done < <(find site/public/icons -type f -name '*.webp' -print0)
tree=$(git write-tree)
if [[ "$tree" == "$(git rev-parse "$parent^{tree}")" ]]; then
  echo 'Talent catalogue and icons are already up to date.'
  exit 0
fi
commit=$(git commit-tree "$tree" -p "$parent" -m 'Refresh Forever talent catalogue')
git push origin "$commit:refs/heads/main"
