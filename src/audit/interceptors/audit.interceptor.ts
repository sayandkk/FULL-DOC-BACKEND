import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string } | undefined;
    const ip = request.ip as string | undefined;
    const userAgent = request.headers['user-agent'] as string | undefined;

    const method = request.method as string;
    const url: string = request.url || '';

    return next.handle().pipe(
      tap(async (data) => {
        // Only log mutating HTTP methods and explicit file/note reads
        const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const isFileView = method === 'GET' && /^\/files\//.test(url);
        const isNoteView = method === 'GET' && /^\/notes\//.test(url);

        if (!isMutating && !isFileView && !isNoteView) {
          return;
        }

        const client = this.prisma as any;

        let entity = 'HTTP';
        let entityId: string | null = null;
        let action = method;

        if (url.startsWith('/files')) {
          entity = 'File';
          entityId = request.params?.id || data?.id || null;
          if (isFileView) {
            action = 'VIEW';
          }
        } else if (url.startsWith('/notes')) {
          entity = 'Note';
          entityId = request.params?.id || data?.id || null;
          if (isNoteView) {
            action = 'VIEW';
          }
        } else if (url.startsWith('/requests')) {
          entity = 'Request';
          entityId = request.params?.id || data?.id || null;
        }

        await client.auditLog.create({
          data: {
            userId: user?.id,
            action,
            entity,
            entityId,
            newValue: data ?? undefined,
            ipAddress: ip,
            userAgent,
          },
        });
      }),
    );
  }
}
