#!/bin/sh
set -eu

PI_DIR="${_REMOTE_USER_HOME}/.pi"
REMOTE_GROUP="$(id -gn "$_REMOTE_USER")"

# Set up the Pi configuration volume target
mkdir -p "$PI_DIR"

# Set ownership for the remote user
chown -R "$_REMOTE_USER:$REMOTE_GROUP" "$PI_DIR"

# Install Pi as the remote user because the native installer writes to the user's home
su - "$_REMOTE_USER" -c 'curl -fsSL https://pi.dev/install.sh | sh'

# Verify the native installation, resolving pi via PATH rather than assuming its install location
su - "$_REMOTE_USER" -c 'pi --version'
