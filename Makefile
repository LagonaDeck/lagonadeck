.DEFAULT_GOAL := help

PROJECTS = frontend api-gateway identity-service media-service

include make/install.mk make/build.mk make/docker.mk make/quality.mk make/help.mk
