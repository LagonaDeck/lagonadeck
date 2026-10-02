install:
	@echo "========= frontend ========="
	@cd frontend && npm install
	@echo "========= api-gateway ========="
	@cd api-gateway && npm install
	@echo "========= identity-service ========="
	@cd identity-service && npm install
	@echo "========= media-service ========="
	@cd media-service && npm install