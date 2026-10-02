# Lit les fichiers make : `##@ Catégorie` ouvre une catégorie,
# `cible: ## description` y ajoute une commande.
BEGIN { FS = ":.*## " }

/^##@ / { categories[++n] = substr($0, 5); next }

/^[a-zA-Z_-]+:.*## / {
  k = ++count[n]
  commands[n, k] = "make " $1
  descriptions[n, k] = $2
}

# Les awk qui comptent en octets (macOS, mawk) comptent aussi les octets de
# continuation UTF-8 : on les retire pour obtenir la largeur affichée.
function width(s) {
  if (length("ç") > 1) gsub("[\200-\277]", "", s)
  return length(s)
}

function pad(s, w) { return s sprintf("%*s", w - width(s), "") }

function line(char, w) { s = ""; while (w-- > 0) s = s char; return s }

function border(left, middle, right) {
  print color left line("─", w1 + 2) middle line("─", w2 + 2) right reset
}

function row(a, b) {
  print color "│" reset " " pad(a, w1) " " color "│" reset " " pad(b, w2) " " color "│" reset
}

END {
  split("36 32 33 35 34", palette, " ")
  reset = "\033[0m"
  for (c = 1; c <= n; c++) {
    color = "\033[1;" palette[(c - 1) % 5 + 1] "m"
    w1 = width("Commande")
    w2 = width("Ce que ça fait")
    for (k = 1; k <= count[c]; k++) {
      if (width(commands[c, k]) > w1) w1 = width(commands[c, k])
      if (width(descriptions[c, k]) > w2) w2 = width(descriptions[c, k])
    }
    print "\n" color categories[c] reset
    border("┌", "┬", "┐")
    row("Commande", "Ce que ça fait")
    border("├", "┼", "┤")
    for (k = 1; k <= count[c]; k++) row(commands[c, k], descriptions[c, k])
    border("└", "┴", "┘")
  }
  print ""
}
