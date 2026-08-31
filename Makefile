.DEFAULT_GOAL := help

.PHONY: help install format-check format-fix lint-check lint-fix linter-check linter-fix test

help:
	@printf '\n\033[1;36mLagonaDeck\033[0m - commandes disponibles\n'
	@printf '\033[2m────────────────────────────────────────────────────────────\033[0m\n'
	@printf '\033[1m  %-20s %s\033[0m\n' 'Commande' 'Description'
	@printf '\033[2m  ──────────────────── ─────────────────────────────────────\033[0m\n'
	@printf '\n\033[1;33mInstallation\033[0m\n'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make install' 'Installe les dépendances du projet via package-lock.json'
	@printf '\n\033[1;33mFormatage\033[0m\n'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make format-check' 'Vérifie le formatage avec Prettier'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make format-fix' 'Corrige le formatage avec Prettier'
	@printf '\n\033[1;33mQualité du code\033[0m\n'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make lint-check' 'Exécute ESLint sur tous les projets'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make lint-fix' 'Corrige automatiquement les problèmes ESLint'
	@printf '  \033[2m(alias: linter-check / linter-fix)\033[0m\n'
	@printf '\n\033[1;33mTests\033[0m\n'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make test' 'Exécute les tests de tous les projets'
	@printf '\n\033[2mUtilisation : make <commande>\033[0m\n\n'

install:
	npm ci

format-check:
	npm run format:check

format-fix:
	npx prettier --write .

lint-check linter-check:
	npm run lint

lint-fix linter-fix:
	npm run lint -- --fix

test:
	npm test
