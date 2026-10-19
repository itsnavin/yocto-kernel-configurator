#!/usr/bin/env bash
# Build only the pinned source's host Kconfig frontend, not a target kernel.
set -euo pipefail
SOURCE=$(realpath "$1")
OUT=$(realpath -m "$2")
mkdir -p "$OUT"
cd "$OUT"
bison -t -l -d -o parser.tab.c "$SOURCE/scripts/kconfig/parser.y"
flex -o lexer.lex.c "$SOURCE/scripts/kconfig/lexer.l"
gcc -O2 -I "$SOURCE/scripts/kconfig" -I . -o conf \
    "$SOURCE/scripts/kconfig/conf.c" "$SOURCE/scripts/kconfig/confdata.c" \
    "$SOURCE/scripts/kconfig/expr.c" "$SOURCE/scripts/kconfig/menu.c" \
    "$SOURCE/scripts/kconfig/preprocess.c" "$SOURCE/scripts/kconfig/symbol.c" \
    "$SOURCE/scripts/kconfig/util.c" parser.tab.c lexer.lex.c
echo "Built $OUT/conf"
