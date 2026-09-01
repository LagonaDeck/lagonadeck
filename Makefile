.DEFAULT_GOAL := help

.PHONY: help install format-check format-fix lint-check lint-fix linter-check linter-fix test docker-up docker-up-detached docker-down docker-logs docker-reset docker-config

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
	@printf '\n\033[1;33mDocker (développement)\033[0m\n'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-up' 'Construit et démarre l’environnement de développement'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-up-detached' 'Construit et démarre l’environnement en arrière-plan'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-down' 'Arrête l’environnement en conservant les données'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-logs' 'Suit les logs de tous les services'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-reset' 'Supprime les conteneurs et volumes de développement'
	@printf '  \033[1;32m%-20s\033[0m %s\n' 'make docker-config' 'Affiche la configuration Compose résolue'
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

COMPOSE_DEV = docker compose -f infrastructure/docker-compose.dev.yml

docker-up:
	$(COMPOSE_DEV) up --build

docker-up-detached:
	$(COMPOSE_DEV) up --build --detach

docker-down:
	$(COMPOSE_DEV) down

docker-logs:
	$(COMPOSE_DEV) logs -f --tail=200

docker-reset:
	$(COMPOSE_DEV) down --volumes --remove-orphans

docker-config:
	$(COMPOSE_DEV) config
