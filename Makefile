PROJECTS = frontend api-gateway identity-service media-service

install:
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm install) || exit 1; done
	@npx --yes lefthook install

build:
	@for p in $(PROJECTS); do echo "========= $$p ========="; (cd $$p && npm run build) || exit 1; done

test:
	@for p in identity-service media-service; do echo "========= $$p ========="; (cd $$p && npm test) || exit 1; done

format:
	@npx --yes prettier@3 --write .

.PHONY: install build test format
