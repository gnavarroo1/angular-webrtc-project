// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import * as uuid from 'uuid';

export const environment = {
  development: true,
  production: false,
  name: 'production',
  token: {
    authHeaderKey: 'Authorization',
  },
  apiServer: {
    api: {
      url: 'http://127.0.0.1:3000/api/',
      methods: {
        //meetings
        getMeeting: 'meetings/:meetingId',
        addMeeting: 'meetings',
        getMeetingMembers: 'meetings/:meetingId/members',
        updateMeetingMember: 'meetings/:meetingId/members/memberId',
        endMeetingSession: 'meetings/:meetingId',
        startBroadcastingSession: 'meetings/:meetingId/broadcasting/start',
        endBroadcastingSession: 'meetings/:meetingId/broadcasting/end',
        //monitoring
        addSnapshot: 'monitoring/meetings/:meetingId/snapshots',
        //security
        resendConfirmationEmail: 'resend-confirmation-email',
        resetPassword: 'reset-password',
        verifyEmail: 'verify-email',
        forgotPassword: 'forgot-password',
        register: 'sign-up',
        login: 'login',
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
    wssUrl: 'ws://127.0.0.1:8098/',
    api: {
      url: 'http://127.0.0.1:8099/',
      namespaces: {},
    },
  },
  videoSettings: {
    //
    width: {
      min: 480,
      max: 1280,
    },
    height: {
      min: 360,
      max: 720,
    },
    framerate: 30, // max fps
    aspectRatio: {
      min: 4 / 3,
      max: 16 / 9,
    },
  },
  maxSendBitrate: 1536000, //1500 kbps ~ 960x540 / 854x480 max bitrate  | 1280x720 min bitrate
  screenSettings: {
    width: {
      min: 640,
    },
    height: {
      min: 480,
    },
  },
  mediasoupClient: {
    configuration: {
      // videoAspectRatio: 1.777,
      // resolution: 'medium',
      // defaultScreenResolution: 'veryhigh',
      // defaultScreenSharingFrameRate: 5,
      // // Enable or disable simulcast for webcam video
      // simulcast: true,
      // Enable or disable simulcast for screen sharing video
      // simulcastSharing: false,
      camVideoSimulcastEncodings: [
        { scaleResolutionDownBy: 4, maxBitrate: 500000 },
        {
          scaleResolutionDownBy: 2,
          maxBitrate: 1000000,
        },
        {
          scaleResolutionDownBy: 1,
          maxBitrate: 5000000,
        },
      ],
    },
  },
  signalingServer: {
    wssUrl: 'ws://127.0.0.1:8000',
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

  mediasoupWssUrl: 'ws://dev.pry2021153.tech:8099',
  mediaSoupApiUrl: 'https://dev.pry2021153.tech:8099/',
  signalingWssUrl: 'ws://127.0.0.1:8000',
  platformApiUrl: 'http://127.0.0.1:3000/api/',
  platformWssUrls: {
    meetingEvents: 'ws://127.0.0.1:3001/meeting-events',
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
