##@ Docker

docker-dev-up: ## Démarre les conteneurs de développement
	@docker compose -f dev.compose.yaml up -d

docker-dev-up-rebuild: ## Démarre les conteneurs de développement en reconstruisant les images
	@docker compose -f dev.compose.yaml up -d --renew-anon-volumes

docker-dev-down: ## Arrête les conteneurs de développement
	@docker compose -f dev.compose.yaml down

docker-dev-restart: ## Redémarre les conteneurs de développement
	@docker compose -f dev.compose.yaml restart

docker-dev-clean: ## Arrête les conteneurs et efface toutes les données (bases et MinIO)
	@docker compose -f dev.compose.yaml down --volumes

.PHONY: docker-dev-up docker-dev-up-rebuild docker-dev-down docker-dev-restart docker-dev-clean
