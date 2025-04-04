// LINE Notifyのライブラリ
import axios, { AxiosStatic } from "axios";

// Error class for invalid token
export class TokenInvalidError extends Error {}

export default class LINENotify {
  private axios: AxiosStatic;

  constructor() {
    this.axios = axios;
  }

  public async notify(token: string, message: string, disableAutoSplit: boolean = false): Promise<void> {
    // 1000文字以上の場合は分割して送信
    if (message.length > 1000 && !disableAutoSplit) {
      // 1000文字ごとに分割する
      const messages = message.match(/[\s\S]{1,1000}/gm);
      if (messages) {
        for (const m of messages) {
          await this._notify(token, m);
        }
      }
    } else {
      await this._notify(token, message);
    }
  }

  private async _notify(token:string, message: string): Promise<void> {
    const endpoint = "https://notify-api.line.me/api/notify";
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    };

    try {
      await this.axios.post(endpoint, `message=${message}`, { headers });
    } catch (error) {
      // 401エラーならTokenInvalidErrorを投げる
      if (
        this.axios.isAxiosError(error) &&
        error.response &&
        error.response.status === 401
      ) {
        throw new TokenInvalidError("The token is invalid. It may have been revoked.");
      }
      // それ以外のエラーはそのまま投げる
      throw error;
    }
  }

  public isTokenInvalidError(error: unknown): boolean {
    return error instanceof TokenInvalidError;
  }
}