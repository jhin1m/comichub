import { Injectable } from '@nestjs/common';

@Injectable()
export class ReadinessService {
  private _isReady = false;

  setReady(): void {
    this._isReady = true;
  }

  get isReady(): boolean {
    return this._isReady;
  }
}
