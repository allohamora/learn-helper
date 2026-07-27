#!/bin/sh
set -eu

OPENCODE_CONFIG_DIR="${_REMOTE_USER_HOME}/.config/opencode"
OPENCODE_DATA_DIR="${_REMOTE_USER_HOME}/.local/share/opencode"
SHELL_CONFIG="${_REMOTE_USER_HOME}/.bashrc"
REMOTE_GROUP="$(id -gn "$_REMOTE_USER")"
OPENCODE_PATH_EXPORT='export PATH="$HOME/.opencode/bin:$PATH"'
OPENCODE_YOLO_ALIAS="alias opencode-yolo='opencode --auto'"

# Set up the OpenCode configuration and data volume targets
mkdir -p "$OPENCODE_CONFIG_DIR" "$OPENCODE_DATA_DIR"
touch "$SHELL_CONFIG"

# Add the native installer location
if ! grep -Fqx "$OPENCODE_PATH_EXPORT" "$SHELL_CONFIG"; then
    printf "\n%s\n" "$OPENCODE_PATH_EXPORT" >> "$SHELL_CONFIG"
fi

# Add the opencode-yolo alias
if ! grep -Fqx "$OPENCODE_YOLO_ALIAS" "$SHELL_CONFIG"; then
    printf "\n%s\n" "$OPENCODE_YOLO_ALIAS" >> "$SHELL_CONFIG"
fi

# Set ownership for the remote user
chown -R "$_REMOTE_USER:$REMOTE_GROUP" "$OPENCODE_CONFIG_DIR" "$OPENCODE_DATA_DIR"
chown "$_REMOTE_USER:$REMOTE_GROUP" "$SHELL_CONFIG"

# Install OpenCode as the remote user because the native installer writes to the user's home
su - "$_REMOTE_USER" -c "$OPENCODE_PATH_EXPORT; curl -fsSL https://opencode.ai/install | bash"

# Verify the native installation
"${_REMOTE_USER_HOME}/.opencode/bin/opencode" --version
