import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined in the environment variables.');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.fileManager = new GoogleAIFileManager(apiKey);
    }
  }

  async askQuestion(filePath: string, mimeType: string, question: string, displayName: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new HttpException('Gemini API is not configured', HttpStatus.NOT_IMPLEMENTED);
    }

    try {
      this.logger.log(`Uploading file ${displayName} to Gemini...`);
      const uploadResult = await this.fileManager.uploadFile(filePath, {
        mimeType: mimeType,
        displayName: displayName || "User Document",
      });

      this.logger.log(`Uploaded file as: ${uploadResult.file.uri}`);

      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      this.logger.log(`Sending question to Gemini...`);
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
          }
        },
        { text: "Based on this document, answer this: " + question },
      ]);

      const responseText = result.response.text();
      
      // We do not await this, we fire and forget the cleanup to keep response times low
      this.fileManager.deleteFile(uploadResult.file.name).catch(e => {
         this.logger.warn(`Failed to cleanup Gemini file ${uploadResult.file.name}: ${e.message}`);
      });
      // Cleanup the local temp file uploaded to the backend
      fs.unlink(filePath, (err) => {
          if(err) this.logger.warn(`Failed to cleanup temp file ${filePath}: ${err.message}`);
      });

      return responseText;
      
    } catch (error: any) {
      this.logger.error(`Error in Gemini Q&A: ${error.message}`, error.stack);
      
      // Cleanup if failed mid-way
      fs.unlink(filePath, (err) => {});
      
      throw new HttpException(
        'Failed to process document question.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
