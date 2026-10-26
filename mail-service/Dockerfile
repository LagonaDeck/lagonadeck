FROM python:3.14-alpine AS dev
COPY --from=ghcr.io/astral-sh/uv:0.12.24 /uv /bin/uv
# Le cache uv et le volume .venv sont sur des systèmes de fichiers différents.
ENV UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked
COPY . .
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3007", "--reload"]

FROM python:3.14-alpine AS prod
COPY --from=ghcr.io/astral-sh/uv:0.12.24 /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
COPY app ./app
CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3007"]
