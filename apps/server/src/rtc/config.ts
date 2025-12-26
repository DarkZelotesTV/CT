import type { RouterOptions, RtpCodecCapability } from 'mediasoup/node/lib/types';

type ProducerCodecOptions = Record<string, unknown>;

export const opus48kCodec: RtpCodecCapability = {
  kind: 'audio',
  mimeType: 'audio/opus',
  clockRate: 48000,
  channels: 2,
  preferredPayloadType: 111,
  parameters: {
    useinbandfec: 1,
    stereo: 1,
    'sprop-stereo': 1,
  },
};

export const defaultRouterOptions: RouterOptions = {
  mediaCodecs: [opus48kCodec],
};

export type ProducerPresetName = 'voice' | 'high' | 'music';

export type ProducerPreset = {
  maxBitrate: number;
  codecOptions?: ProducerCodecOptions;
};

const sharedOpusOptions: ProducerCodecOptions = {
  opusMaxPlaybackRate: opus48kCodec.clockRate,
};

export const producerPresets: Record<ProducerPresetName, ProducerPreset> = {
  voice: {
    maxBitrate: 32_000,
    codecOptions: {
      ...sharedOpusOptions,
      opusStereo: false,
      opusDtx: true,
      opusFec: true,
      opusPtime: 20,
    },
  },
  high: {
    maxBitrate: 64_000,
    codecOptions: {
      ...sharedOpusOptions,
      opusStereo: true,
      opusDtx: true,
      opusFec: true,
      opusPtime: 20,
    },
  },
  music: {
    maxBitrate: 128_000,
    codecOptions: {
      ...sharedOpusOptions,
      opusStereo: true,
      opusDtx: false,
      opusFec: true,
      opusPtime: 20,
    },
  },
};

export const resolveProducerPreset = (preset?: ProducerPresetName | null) => producerPresets[preset ?? 'voice'] ?? producerPresets.voice;
