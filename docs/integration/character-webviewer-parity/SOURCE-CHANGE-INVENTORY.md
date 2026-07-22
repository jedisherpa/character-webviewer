# Source change inventory (from RobinSpeech `0f614b4`)

| change_id | type | public_contract | viewer_routes | status |
|-----------|------|-----------------|---------------|--------|
| RS-01 | broadcast sources optional Joe AI/General/manual | `BroadcastSourceDefinition` v1 | /studio, LiveDock, /41birdlive | integrate |
| RS-02 | isolated rant feed paths `/api/rant/feed/joe-news-*` | queue API consumer | /studio, LiveDock | integrate |
| RS-03 | scene catalog voxel×10 + original bull + bowl | `SceneDefinition` v1 | /studio native | integrate |
| RS-04 | Wall Street Bull RGBA overlay + NDC box | scene assets + world stack | /studio | integrate |
| RS-05 | Nate voice Ifu36 + multilingual_v2 + speed 0.9 | `VoiceProfileReference` v1 Joe-only | Joe TTS via backend | integrate |
| RS-06 | Preview≠Program Take | `ProgramSnapshot`/`TakeCommand` | /studio | integrate |
| RS-07 | News Wiz profile header/provenance | bounded provenance only | story cards | integrate |
| RS-08 | birdLive SPA shell | iframe /41birdlive | /41birdlive | preserve embed |
| RS-09 | bull-plates historical assets | public assets | /studio | integrate |
| RS-10 | JoeNEWS fact-lock rant planning | prepared scripts only | LiveDock rant | preserve adapter |

Internal-only (no viewer consumer): Cargo/persona.toml bulk voice id string updates, CLI packaging scripts, nginx conf.
