import { HttpClient } from '@angular/common/http';

export class MediasoupApiService {
  constructor(private http: HttpClient) {}

  getRouterRtpCapabilities(): any {
    return;
  }

  getAudioProducersIds(): any {}
  getVideoProducersIds(): any {}
  createWebRtcTransport(): any {}
  connectWebRtcTransport(): any {}
  produce(): any {}
}
