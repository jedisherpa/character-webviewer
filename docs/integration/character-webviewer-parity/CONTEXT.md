# Character Webviewer ↔ 41 Bird Live parity — frozen context

## Frozen revisions (this session)

| Repository | Branch | HEAD | Notes |
|------------|--------|------|--------|
| character-webviewer | feat/newswiz-same-origin-embed | `8df56270e73b73109887a16e1f7616154c348eec` | Dirty local (bull plates, performer switch, choreography) |
| RobinSpeech | feat/newswiz-continuous-rant-port | `0f614b4c363af9df45768fc200dcf3c6468ecf22` | Authoritative birdLive + Nate voice commit |
| joe-newsroom | feat/news-wiz-nate-profile (merged main `ade2baa0`) | `a74ae14aa9e9816139ff3a2e72931734bcb3ff6f` | News Wiz profile package |
| robert-backend-one-bird-live | feat/choreography-stt-upgrades | `3ac9815526fe071d362a492b8b12de19793c2c20` | Parallel birdLive UI host |

## Authority

- **Live runtime / backend:** RobinSpeech / 41 Bird Live (`prism-dodeca-cli`, rant/Joe feeds, TTS).
- **Character inspection / rehearsal / production control surface:** character-webviewer.
- **Editorial profile producer:** joe-newsroom News Wiz package (browser consumes provenance only).

## Constraints

- No ElevenLabs or feed secrets in browser bundle.
- No reimplementation of 37-section News Wiz in browser.
- Nate voice is Wizard Joe only.
- Program changes only via Take.
- Offline/static mode remains useful without live backend.
