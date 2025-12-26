# Producer Setup (Mediasoup)

## Router-Default: Opus @ 48 kHz
- `apps/server/src/rtc/config.ts` definiert `defaultRouterOptions` mit einem einzigen `mediaCodec`: Opus (48 kHz, Stereo, In-Band FEC).
- `WorkerPool.createRouter` verwendet diese Defaults automatisch. Wenn du eigene `RouterOptions` übergibst, werden die Defaults zusammengeführt (der Opus-Codec bleibt als Basis erhalten).

## Producer-Presets
`config.ts` enthält vordefinierte Presets für Audio-Producers, inklusive Bitrate und `codecOptions` für Opus.

| Preset | maxBitrate (bps) | stereo | DTX | FEC | Hinweis |
| --- | --- | --- | --- | --- | --- |
| `voice` | 32_000 | nein | ja | ja | Sprach-optimiert, Bandbreite-sparend |
| `high` | 64_000 | ja | ja | ja | Höhere Qualität, weiterhin DTX |
| `music` | 128_000 | ja | nein | ja | Musik/Streaming, ohne DTX |

- Gemeinsame Optionen: `opusMaxPlaybackRate` wird auf 48 kHz gesetzt, `opusPtime` auf 20 ms.
- Zugriff über `producerPresets` oder `resolveProducerPreset(presetName)`, wobei der Fallback `voice` ist.

## Anwendung in Producer-Erstellung
1. Wähle ein Preset, z. B. `const { maxBitrate, codecOptions } = resolveProducerPreset('high');`.
2. Übergib Werte bei der Producer-Erstellung (z. B. `transport.produce({ maxBitrate, codecOptions, ... })`).
3. Falls dynamisch, speichere das verwendete Preset in `appData`, um Client/Moderation zu informieren.

Damit ist der Standard-Router auf Opus 48 kHz konfiguriert und Producer erhalten konsistente Audio-Profile.
