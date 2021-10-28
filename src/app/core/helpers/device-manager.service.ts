import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';
export type Devices = MediaDeviceInfo[];

interface DisplayMediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}
interface IMediaDevices extends MediaDevices {
  getDisplayMedia(
    constraints?: DisplayMediaStreamConstraints
  ): Promise<MediaStream>;
}

@Injectable({
  providedIn: 'root',
})
export class DeviceService {
  _devices: Observable<Promise<Devices>>;
  private deviceBroadcast = new ReplaySubject<Promise<Devices>>();

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
    return new Promise<MediaStream>((resolve, reject) => {
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          resolve(stream);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  private getMediaDevicesConstraints() {
    const supports = navigator.mediaDevices.getSupportedConstraints();
    if (!supports['width'] || !supports['height']) {
      throw Error('Unsupported constraints');
    } else {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: {
          width: environment.videoSettings.width,
          height: environment.videoSettings.height,
        },
      };
      if (supports.frameRate) {
        (constraints.video as MediaTrackConstraints).frameRate =
          environment.videoSettings.framerate;
      }
      if (supports.aspectRatio) {
        (constraints.video as MediaTrackConstraints).aspectRatio =
          environment.videoSettings.aspectRatio;
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
  public async getDisplayMedia(): Promise<MediaStream> {
    const mediaDevices = navigator.mediaDevices as IMediaDevices;
    return new Promise((resolve, reject) => {
      return mediaDevices
        .getDisplayMedia({
          video: environment.screenSettings,
        })
        .then((stream) => {
          resolve(stream);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }
}
