# PawClaw pet format

Each pet has its own directory:

```text
pets/
└── ember/
    ├── pet.json
    ├── preview.png
    ├── ATTRIBUTION.md
    └── sprites/
        ├── idle.png
        ├── walk.png
        └── alert.png
```

Spritesheets are horizontal PNG images. Every frame must have the same dimensions and the sheet width must equal `frameWidth × frames`. Integer `scale` values preserve crisp pixel art.

## Manifest

```json
{
  "id": "ember",
  "name": "Ember",
  "species": "comodo-dragon",
  "scale": 4,
  "enabled": true,
  "preview": "preview.png",
  "animations": {
    "idle": {
      "src": "sprites/idle.png",
      "frameWidth": 16,
      "frameHeight": 16,
      "frames": 4,
      "fps": 4,
      "loop": true
    }
  }
}
```

`idle` is required. Other supported animations are `walk`, `sleep`, `think`, `talk`, `celebrate`, and `alert`. When the animation selected for an application state is missing, the renderer falls back to `idle`.

Set `enabled` to `false` while optional third-party assets have not been installed. Disabled manifests are schema-checked but their missing image files do not fail repository validation.

## Third-party artwork

When attribution is required, include both an `attribution` object in `pet.json` and an `ATTRIBUTION.md` next to the assets:

```json
{
  "attribution": {
    "creator": "Originum",
    "source": "https://originum.itch.io/comodo-dragon",
    "license": "Free to use in projects with credit to Originum",
    "required": true
  }
}
```

Do not commit original source archives unless their license explicitly permits redistribution. Prefer importing only the derived runtime images required by PawClaw.
