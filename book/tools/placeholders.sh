#!/usr/bin/env bash
# Lists the content that still has to be supplied before the book is final:
#   1. \fillme{...} markers (shown in red in the PDF)
#   2. screenshots referenced by the book but missing from figures/screenshots/
cd "$(dirname "$0")/.."

echo "== Text placeholders (\\fillme) =="
grep -rn --include=*.tex '\\fillme{' chapters frontmatter appendices || echo "none"

echo
echo "== Screenshots =="
missing=0
name='[A-Za-z0-9_]+'

# \screenshot[w]{name}{...}  and  \screenshotpair{a}{b}{...}
for r in $(grep -rhoE --include=*.tex "\\\\screenshot(\[[^]]*\])?\{$name\}" chapters appendices | grep -oE "\{$name\}" | tr -d '{}' | sort -u) \
         $(grep -rhoE --include=*.tex "\\\\screenshotpair\{$name\}\{$name\}" chapters appendices | grep -oE "\{$name\}" | tr -d '{}' | sort -u); do
  [ -f "figures/screenshots/$r.png" ] || { echo "missing: figures/screenshots/$r.png"; missing=1; }
done

# \scrollshot[cuts]{name}{...}: only the source image is needed (panels are clipped by LaTeX)
for r in $(grep -rhoE --include=*.tex "\\\\scrollshot(\[[0-9.,]+\])?\{$name\}" chapters appendices | grep -oE "\{$name\}" | tr -d '{}' | sort -u); do
  [ -f "figures/screenshots/$r.png" ] || { echo "missing: figures/screenshots/$r.png"; missing=1; }
done

[ $missing -eq 0 ] && echo "all screenshots present"
exit 0
