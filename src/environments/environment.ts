// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import * as uuid from 'uuid';

export const environment = {
  production: false,
  name: 'development',
  wssUrl: 'ws://127.0.0.1:5001',
  user_id: uuid.v4(),
  camVideoSimulcastEncodings: [
    { maxBitrate: 96000, scaleResolutionDownBy: 4 },
    { maxBitrate: 680000, scaleResolutionDownBy: 1 },
  ],
  testRoom: '4zsnRr+4wWBLFcSb',
};
