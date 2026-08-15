# Third-party assets

## Battambang

`src/assets/fonts/Battambang-{Regular,Bold}.ttf`

Copyright 2019 The Battambang Project Authors
(https://github.com/danhhong/Battambang). Licensed under the SIL Open Font
License, Version 1.1 — see `src/assets/fonts/OFL.txt`.

Embedded into generated PDF reports. Khmer is a complex script: the correct
glyphs are not a codepoint-to-glyph mapping but the result of OpenType shaping —
subscript consonants stack below the base, and the subscript ro reorders to the
front of its cluster.

Battambang rather than the Noto Sans Khmer the web interface uses, because
fontkit (which pdfkit lays text out through) dereferences a null GPOS anchor on
`ម` + `៉` in every Noto Khmer build, and throws mid-render. Browsers shape Noto
correctly, so the web side is unaffected.

Latin runs in the same PDF use the built-in Helvetica, so only this one family is
shipped.
