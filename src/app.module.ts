import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { InwardModule } from './inward/inward.module';
import { FilesModule } from './files/files.module';
import { NotesModule } from './notes/notes.module';
import { DocumentsModule } from './documents/documents.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { ArchiveModule } from './archive/archive.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ClassificationsModule } from './classifications/classifications.module';
import { RequestsModule } from './requests/requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PdfModule } from './pdf/pdf.module';
import { AuditInterceptor } from './audit/interceptors/audit.interceptor';
import { GeminiModule } from './gemini/gemini.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    InwardModule,
    FilesModule,
    NotesModule,
    DocumentsModule,
    DashboardModule,
    SearchModule,
    ArchiveModule,
    WorkflowModule,
    ClassificationsModule,
    RequestsModule,
    NotificationsModule,
    PdfModule,
    GeminiModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }
