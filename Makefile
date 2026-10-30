.DEFAULT_GOAL := help

PROJECTS = frontend api-gateway identity-service media-service inventory-service purchase-service

# mail-service est en Python : ses commandes passent par uv. Sans uv, il est
# ignoré en local ; la CI le vérifie toujours.
mail_service = echo "========= mail-service ========="; \
	if command -v uv >/dev/null 2>&1; then (cd mail-service && $(1)); \
	else echo "uv absent, mail-service ignoré : https://docs.astral.sh/uv/"; fi

include make/install.mk make/build.mk make/docker.mk make/quality.mk make/help.mk
