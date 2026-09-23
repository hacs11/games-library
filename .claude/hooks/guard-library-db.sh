#!/usr/bin/env bash
# Writing to data/library.db from the host while the container holds it open
# corrupts the view the container has of it ("database disk image is malformed",
# see CLAUDE.md). Reads are harmless, so this only blocks a write, and only
# while games-library-web-1 is actually running.
#
# ponytail: substring match on the path, not real command parsing. A write
# smuggled past it (a script that opens the file by another name) is not caught;
# parse properly only if that ever actually happens.
set -uo pipefail

target=$(jq -r '[.tool_input.command // "", .tool_input.file_path // ""] | join(" ")')

case "$target" in *library.db*) ;; *) exit 0 ;; esac
case "$target" in *mode=ro*|*-readonly*) exit 0 ;; esac          # an explicitly read-only open cannot corrupt it
docker ps -q -f name=games-library-web-1 2>/dev/null | grep -q . || exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "games-library-web-1 is up, and a host-side write to data/library.db corrupts the view the container has of it. Use the app own buttons, or stop the container first. To read, open it read-only: sqlite3 \"file:data/library.db?mode=ro\"."
  }
}'
