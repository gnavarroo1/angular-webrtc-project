import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiRestService {
  constructor(private http: HttpClient) {}
  addMeeting(data: any): Observable<any> {
    const url =
      environment.apiServer.api.url +
      environment.apiServer.api.methods.addMeeting;
    return this.http.post<any>(url, data);
  }

  getMeeting(meetingId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.getMeeting
    ).replace(':meetingId', meetingId);
    return this.http.get<any>(url);
  }

  getMeetingMembers(meetingId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.getMeetingMembers
    ).replace(':meetingId', meetingId);
    return this.http.get<any>(url);
  }

  updateMeetingMember(meetingId: string, memberInfo: any): Observable<any> {
    let url =
      environment.apiServer.api.url +
      environment.apiServer.api.methods.updateMeetingMember;
    url = url
      .replace(':meetingId', meetingId)
      .replace(':memberId', memberInfo.id);
    return this.http.put<any>(url, memberInfo);
  }

  endMeetingSession(meetingId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.endMeetingSession
    ).replace(':meetingId', meetingId);
    return this.http.delete<any>(url);
  }

  listMeetingMembers(meetingId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.getMeetingMembers
    ).replace(':meetingId', meetingId);
    return this.http.get<any>(url);
  }

  startBroadcastingSession(meetingId: string, userId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.startBroadcastingSession
    ).replace(':meetingId', meetingId);
    return this.http.post(url, {
      meetingId: meetingId,
      userId: userId,
    });
  }
  endBroadcastingSession(meetingId: string, userId: string): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.endBroadcastingSession
    ).replace(':meetingId', meetingId);
    return this.http.post(url, {
      meetingId: meetingId,
      userId: userId,
    });
  }

  addSnapshot(data: any): Observable<any> {
    const url = (
      environment.apiServer.api.url +
      environment.apiServer.api.methods.addSnapshot
    ).replace(':meetingId', data.meetingId);
    return this.http.post(url, data);
  }
}
