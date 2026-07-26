#!/bin/sh
set -eu

WORKSPACES_DIR="/workspaces"
NODE_MODULES_DIR="$WORKSPACES_DIR/learn-helper/node_modules"

# Set up the node_modules volume target
mkdir -p "$NODE_MODULES_DIR"
chown -R "$_REMOTE_USER:$(id -gn "$_REMOTE_USER")" "$WORKSPACES_DIR"
