#!/bin/sh
set -eu

CLAUDE_DIR="${_REMOTE_USER_HOME}/.claude"
CLAUDE_CONFIG="${_REMOTE_USER_HOME}/.claude.json"
SHELL_CONFIG="${_REMOTE_USER_HOME}/.bashrc"
REMOTE_GROUP="$(id -gn "$_REMOTE_USER")"
CC_ALIAS="alias cc='claude --dangerously-skip-permissions'"

# Set up the Claude configuration volume target and persistent .claude.json symlink
mkdir -p "$CLAUDE_DIR"
ln -snf "$CLAUDE_DIR/__do_not_use_user_claude.json" "$CLAUDE_CONFIG"
touch "$SHELL_CONFIG"

# Add the cc alias
if ! grep -Fqx "$CC_ALIAS" "$SHELL_CONFIG"; then
    printf "\n%s\n" "$CC_ALIAS" >> "$SHELL_CONFIG"
fi

# Set ownership for the remote user
chown -R "$_REMOTE_USER:$REMOTE_GROUP" "$CLAUDE_DIR"
chown -h "$_REMOTE_USER:$REMOTE_GROUP" "$CLAUDE_CONFIG"
chown "$_REMOTE_USER:$REMOTE_GROUP" "$SHELL_CONFIG"
