import { z } from 'zod';

export const rtcTransportDefaultsSchema = z.undefined().optional();

export const rtcCreateTransportSchema = z.object({
  channelId: z.number().int().positive(),
  direction: z.enum(['send', 'recv']),
});

export const rtcConnectTransportSchema = z.object({
  transportId: z.string().min(1),
  dtlsParameters: z
    .object({
      fingerprints: z
        .array(
          z.object({
            algorithm: z.string().min(1),
            value: z.string().min(1),
          }),
        )
        .min(1),
    })
    .passthrough(),
});

export const rtcProduceSchema = z.object({
  channelId: z.number().int().positive(),
  transportId: z.string().min(1),
  rtpParameters: z.object({}).passthrough(),
  appData: z.record(z.any()).optional(),
});

export const rtcConsumeSchema = z.object({
  channelId: z.number().int().positive(),
  transportId: z.string().min(1),
  producerId: z.string().min(1),
  rtpCapabilities: z.object({}).passthrough(),
  appData: z.record(z.any()).optional(),
});

export const rtcPauseConsumerSchema = z.object({
  consumerId: z.string().min(1),
});

export const rtcResumeConsumerSchema = rtcPauseConsumerSchema;

export const rtcJoinRoomSchema = z.object({
  channelId: z.number().int().positive(),
});

export const requestServerMembersSchema = z.object({
  serverId: z.number().int().positive(),
});

export const channelIdSchema = z.number().int().positive();
