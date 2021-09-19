// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import * as uuid from 'uuid';

export const environment = {
  user_id: uuid.v4(),
  production: false,
  name: 'development',
  apiServer: {
    api: {
      url: 'http://127.0.0.1:3000/api/',
      methods: {
        getMeeting: 'meetings/:meetingId',
        addMeeting: 'meetings',
        getMeetingMembers: 'meetings/:meetingId/members',
        updateMeetingMember: 'meetings/:meetingId/members/memberId',
        endMeetingSession: 'meetings/:meetingId',
      },
    },
    wss: {
      url: 'ws://127.0.0.1:3000/',
      namespaces: {
        meeting: 'meeting-events',
      },
    },
  },
  mediasoupServer: {
    wssUrl: 'wss://dev.pry2021153.tech:8099',
    api: {
      url: 'https://dev.pry2021153.tech:8099/',
      namespaces: {},
    },
  },
  mediasoupClient: {
    configuration: {
      videoAspectRatio: 1.777,
      resolution: 'medium',
      framerate: 15,
      defaultScreenResolution: 'veryhigh',
      defaultScreenSharingFrameRate: 5,
      // Enable or disable simulcast for webcam video
      simulcast: true,
      // Enable or disable simulcast for screen sharing video
      simulcastSharing: false,
      camVideoSimulcastEncodings: [
        {
          rid: 'r0',
          maxBitrate: 100000,
          scaleResolutionDownBy: 4,
          scalabilityMode: 'S1T3',
        },
        {
          rid: 'r1',
          maxBitrate: 12000000,
          scaleResolutionDownBy: 1,
          scalabilityMode: 'S1T3',
        },
      ],
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
      ],
      iceCandidatePoolSize: 10,
    },
  },
  signalingServer: {
    wssUrl: 'ws://127.0.0.1:5000',
  },
  webrtcP2PConfiguration: {
    rtcConfiguration: {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
      ],
      iceCandidatePoolSize: 10,
    },
  },
  storageValues: {
    auth: 'Authorization',
    guessName: 'meeting.guessName',
  },

  mediasoupWssUrl: 'wss://dev.pry2021153.tech:8099',
  mediaSoupApiUrl: 'https://dev.pry2021153.tech:8099/',
  signalingWssUrl: 'ws://127.0.0.1:5000',
  platformApiUrl: 'http://127.0.0.1:3000/api/',
  platformWssUrls: {
    meetingEvents: 'ws://127.0.0.1:3000/meeting-events',
  },

  camVideoSimulcastEncodings: [
    { maxBitrate: 96000, scaleResolutionDownBy: 4 },
    { maxBitrate: 680000, scaleResolutionDownBy: 1 },
  ],
  testRoom: '4zsnRr+4wWBLFcSb',
  rtcConfiguration: {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: 'stun:stun1.l.google.com:19302',
      },
      {
        urls: 'stun:stun2.l.google.com:19302',
      },
    ],
    iceCandidatePoolSize: 10,
  },
  token: 'Authorization',
  lsGuessName: 'meeting.guessName',
};
