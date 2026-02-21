# TeaVM ZIP Translator (Railway-ready)

Yes — this repository now includes a Railway-deployable app that accepts a ZIP of Java source and translates it to JavaScript or WebAssembly using TeaVM.

## What this app does

- Exposes an HTTP API with:
  - `GET /health`
  - `POST /translate`
- Accepts multipart form upload of a ZIP file and compiles it using TeaVM.
- Returns a ZIP containing TeaVM output (`app.js` for JS target or `app.wasm` for WASM target).

## API

### `POST /translate`

Multipart fields:

- `archive` (required): ZIP file with Java source.
- `mainClass` (required): fully-qualified Java entrypoint class (example: `com.example.Main`).
- `target` (optional): `js` (default) or `wasm`.
- `classPath` (optional): source root inside the ZIP. Defaults to `src/main/java`.

> The uploaded ZIP should generally follow Maven-style source layout by default (`src/main/java`).

## Local run

```bash
npm install
npm start
```

## Example request

```bash
curl -X POST http://localhost:3000/translate \
  -F "archive=@./your-java-project.zip" \
  -F "mainClass=com.example.Main" \
  -F "target=js" \
  -o translated-js.zip
```

## Railway deployment

This repo includes:

- `Dockerfile` (Node + Maven + OpenJDK 17)
- `railway.json`

Deploy steps:

1. Push this repo to GitHub.
2. In Railway, create a new project from that repo.
3. Railway builds with the Dockerfile and starts the API.
4. Use generated Railway URL to call `/translate`.

## Notes

- Build times depend on project size.
- TeaVM compatibility depends on Java APIs used by uploaded code.
- `TEAVM_VERSION` can be overridden via environment variable.
