# Adept Game Plugins

Plugin ecosystem for the Adept show platform. Contains the shared SDK and first-party plugins.

## Structure

```
packages/
  plugin-sdk/   @adept/plugin-sdk — canonical types consumed by all plugins and by Adept-Game
```

## Plugin shape

Each plugin is a normal npm package with a custom `adept` field in `package.json`:

```json
{
  "name": "@adept-plugins/my-segment",
  "version": "1.0.0",
  "exports": {
    ".":        "./dist/server.js",
    "./client": "./dist/client.js"
  },
  "peerDependencies": { "@adept/plugin-sdk": "^1.0.0" },
  "adept": {
    "pluginId": "my-segment",
    "apiVersion": 1,
    "capabilities": {
      "segments": [{ "id": "my_seg", "slot": "after:round:2", "next": "round:3" }],
      "cardKinds": []
    }
  }
}
```

Two entry points:
- `./dist/server.js` — exports `registerServer(registry: PluginServerRegistry)`
- `./dist/client.js` — exports `registerClient(registry: PluginClientRegistry)`

## Installing a plugin into Adept-Game

Pin to an annotated tag or commit SHA — never a branch:

```jsonc
// Adept-Game/package.json
"@adept-plugins/my-segment": "github:adept-tv/plugin-my-segment#v1.0.0"
```

The resolved commit SHA is locked in `package-lock.json`. Every update is a PR.

## Trust model

- Only repos/orgs listed in `requirements/plugin-allowlist.json` are accepted.
- The validator CLI (`packages/validator-cli`, forthcoming) enforces the allowlist,
  checks graph reachability, and optionally verifies GPG-signed tags.
- Plugin code runs inside the main bundle — no iframe, no runtime fetch.
- The registry enforces capability declarations even for trusted code.

## Development

```bash
npm install
npm run build
```
