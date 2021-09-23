export interface IAuthTokenDecoded {
  username?: string;
  sub: string;
  sessionId: string;
  isGuest: boolean;
}

export interface IHasAuthTokenResponse {
  hasAuthToken: boolean;
  isExpired?: boolean;
  user?: IAuthTokenDecoded;
}
export interface IDecodeTokenResponse {
  success: boolean;
  msg: any;
}
