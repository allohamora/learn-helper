#!/bin/sh
set -eu

CODEX_DIR="${_REMOTE_USER_HOME}/.codex"
SHELL_CONFIG="${_REMOTE_USER_HOME}/.bashrc"
REMOTE_GROUP="$(id -gn "$_REMOTE_USER")"
CODEX_PATH_EXPORT='export PATH="$HOME/.local/bin:$PATH"'

# Set up the Codex configuration volume target
mkdir -p "$CODEX_DIR"
touch "$SHELL_CONFIG"

# Add the native installer location
if ! grep -Fqx "$CODEX_PATH_EXPORT" "$SHELL_CONFIG"; then
    printf "\n%s\n" "$CODEX_PATH_EXPORT" >> "$SHELL_CONFIG"
fi

# Set ownership for the remote user
chown -R "$_REMOTE_USER:$REMOTE_GROUP" "$CODEX_DIR"
chown "$_REMOTE_USER:$REMOTE_GROUP" "$SHELL_CONFIG"

# Install Codex as the remote user because the native installer writes to the user's home
su - "$_REMOTE_USER" -c "$CODEX_PATH_EXPORT; curl -fsSL https://chatgpt.com/codex/install.sh | sh"

# Verify the native installation
"${_REMOTE_USER_HOME}/.local/bin/codex" --version
