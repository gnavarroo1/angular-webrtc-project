import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';
export type Devices = MediaDeviceInfo[];
@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  _devices: Observable<Promise<Devices>>;
  private deviceBroadcast = new ReplaySubject<Promise<Devices>>();
  private videoAspectRatio = { min: 4 / 3, max: 1 };
  private width = { min: 640, max: 1280 };
  private height = { min: 480, max: 720 };

  constructor() {
    if (navigator && navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = (_: Event) => {
        this.deviceBroadcast.next(this.getDeviceOptions());
      };
    }
    this._devices = this.deviceBroadcast.asObservable();
    this.deviceBroadcast.next(this.getDeviceOptions());
  }

  private async permissionsGranted() {
    if (navigator && navigator['permissions']) {
      try {
        const result = await navigator['permissions'].query({ name: 'camera' });
        if (result) {
          if (result.state === 'granted') {
            return true;
          } else {
            return await new Promise<boolean>((resolve) => {
              result.onchange = (_: Event) => {
                // @ts-ignore
                const granted = _.target['state'] === 'granted';
                if (granted) {
                  resolve(true);
                }
              };
            });
          }
        }
      } catch (e) {
        return true;
      }
    }
    return false;
  }

  private async getDeviceOptions(): Promise<Devices> {
    const isGranted = await this.permissionsGranted();
    if (navigator && navigator.mediaDevices && isGranted) {
      let devices = await this.tryGetDevices();
      if (devices.every((d) => !d.label)) {
        devices = await this.tryGetDevices();
      }
      return devices;
    }
    // @ts-ignore
    return null;
  }

  private async tryGetDevices() {
    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    return ['audioinput', 'audiooutput', 'videoinput'].reduce(
      (options, kind) => {
        // @ts-ignore
        return (options[kind] = mediaDevices.filter(
          (device) => device.kind === kind
        ));
      },
      [] as Devices
    );
  }

  public async getUserMedia(): Promise<MediaStream> {
    const constraints = this.getMediaDevicesConstraints();
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  private getMediaDevicesConstraints() {
    const { framerate } = environment.mediasoupClient.configuration;
    const supports = navigator.mediaDevices.getSupportedConstraints();
    if (!supports['width'] || !supports['height']) {
      throw Error('Unsupported constraints');
    } else {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: {
          aspectRatio: this.videoAspectRatio,
          width: this.width,
          height: this.height,
        },
      };
      if (supports.frameRate) {
        (constraints.video as MediaTrackConstraints).frameRate = framerate;
      }
      if (supports.echoCancellation) {
        switch (typeof constraints.audio) {
          case 'boolean':
          case 'undefined':
            constraints.audio = {
              echoCancellation: true,
            };
            break;
          default:
            constraints.audio = {
              ...constraints.audio,
              echoCancellation: true,
            };
            break;
        }
      }

      return constraints;
    }
  }
}
