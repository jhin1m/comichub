import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

export interface SseEvent {
  data: string;
}

@Injectable()
export class SseConnectionManagerService {
  private static readonly MAX_CONNECTIONS_PER_USER = 5;
  private connections = new Map<number, Set<Subject<SseEvent>>>();

  addConnection(userId: number): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    const userConns = this.connections.get(userId)!;

    // Evict oldest connection if limit reached
    if (
      userConns.size >= SseConnectionManagerService.MAX_CONNECTIONS_PER_USER
    ) {
      const oldest = userConns.values().next().value;
      if (oldest) {
        oldest.complete();
        userConns.delete(oldest);
      }
    }

    userConns.add(subject);

    return subject.asObservable().pipe(
      finalize(() => {
        this.connections.get(userId)?.delete(subject);
        if (this.connections.get(userId)?.size === 0) {
          this.connections.delete(userId);
        }
      }),
    );
  }

  pushToUser(userId: number, data: object): void {
    const subjects = this.connections.get(userId);
    if (!subjects) return;
    const event: SseEvent = { data: JSON.stringify(data) };
    subjects.forEach((s) => {
      try {
        s.next(event);
      } catch {
        subjects.delete(s);
      }
    });
  }

  pushToUsers(userIds: number[], data: object): void {
    for (const id of userIds) this.pushToUser(id, data);
  }
}
