#!/usr/bin/env sh
set -e

# Get the directory of this script, resolving symlinks
SOURCE_DIR=$(dirname "$(readlink -f "$0" || realpath "$0")")

# The project root is one level up from the bin directory
PROJECT_ROOT="$SOURCE_DIR/.."

# Path to the local tsx executable
TSX_PATH="$PROJECT_ROOT/node_modules/.bin/tsx"

# Path to the main source file
MAIN_FILE="$PROJECT_ROOT/src/index.ts"

# Path to the tsconfig.json
TSCONFIG_PATH="$PROJECT_ROOT/tsconfig.json"

# Execute the application using the local tsx and the correct tsconfig
exec "$TSX_PATH" --tsconfig "$TSCONFIG_PATH" "$MAIN_FILE" "$@"