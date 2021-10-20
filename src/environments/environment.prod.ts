// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import * as uuid from 'uuid';

export const environment = {
  development: false,
  user_id: uuid.v4(),
  production: false,
  name: 'development',
  token: {
    authHeaderKey: 'Authorization',
  },
  apiServer: {
    api: {
      url: 'https://api-webrtc.pry2021153.tech:3000/api/',
      methods: {
        getMeeting: 'meetings/:meetingId',
        addMeeting: 'meetings',
        getMeetingMembers: 'meetings/:meetingId/members',
        updateMeetingMember: 'meetings/:meetingId/members/memberId',
        endMeetingSession: 'meetings/:meetingId',
        startBroadcastingSession: 'meetings/:meetingId/broadcasting/start',
        endBroadcastingSession: 'meetings/:meetingId/broadcasting/end',
        register: 'sign-up',
        login: 'login',
      },
    },
    wss: {
      url: 'wss://api-webrtc.pry2021153.tech:3000/',
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
          scaleResolutionDownBy: 8,
          maxBitrate: 100000,
          scalabilityMode: 'S1T3',
        },
        {
          rid: 'r1',
          scaleResolutionDownBy: 4,
          maxBitrate: 200000,
          scalabilityMode: 'S1T3',
        },
        {
          rid: 'r2',
          scaleResolutionDownBy: 2,
          maxBitrate: 700000,
          scalabilityMode: 'S1T3',
        },
        {
          rid: 'r3',
          scaleResolutionDownBy: 1,
          maxBitrate: 2500000,
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
    wssUrl: 'wss://signaling.pry2021153.tech:8000',
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
  platformApiUrl: 'https://api-webrtc.pry2021153.tech:3000/api/',
  platformWssUrls: {
    meetingEvents: 'wss://api-webrtc.pry2021153.tech:3000/meeting-events',
  },
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

  lsGuessName: 'meeting.guessName',
};
