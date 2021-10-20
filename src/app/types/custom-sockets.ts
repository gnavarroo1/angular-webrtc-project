import { environment } from '../../environments/environment';
import { Socket } from 'ngx-socket-io';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SignalingSocket extends Socket {
  constructor() {
    super({
      url: environment.signalingServer.wssUrl,
      options: {
        query: {
          token: localStorage.getItem(environment.token.authHeaderKey),
        },
      },
    });
  }
}

@Injectable({
  providedIn: 'root',
})
export class MediasoupSocket extends Socket {
  constructor() {
    super({
      url: environment.mediasoupServer.wssUrl,
      options: {
        query: {
          token: localStorage.getItem(environment.token.authHeaderKey),
          session_id: '4zsnRr+4wWBLFcSb',
          user_id: environment.user_id,
        },
      },
    });
  }
}

@Injectable({
  providedIn: 'root',
})
export class ApiMeetingNamespaceSocket extends Socket {
  constructor() {
    super({
      url:
        environment.apiServer.wss.url +
        environment.apiServer.wss.namespaces.meeting,
      options: {
        transportOptions: {
          polling: {
            extraHeaders: {
              Authorization: localStorage.getItem(
                environment.token.authHeaderKey
              ),
            },
          },
        },
      },
    });
  }
}
