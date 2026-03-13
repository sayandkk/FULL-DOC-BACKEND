import { Controller, Post, Body, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GeminiService } from './gemini.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

interface QnARequest {
    question: string;
}

@Controller('gemini')
export class GeminiController {
    constructor(private readonly geminiService: GeminiService) {}

    @Post('ask')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/temp', // Temporary holding before sending to Gemini
            filename: (req, file, cb) => {
                const uniqueSuffix = uuidv4() + path.extname(file.originalname);
                cb(null, uniqueSuffix);
            }
        })
    }))
    async askQuestion(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: QnARequest
    ) {
        if (!file) {
            throw new HttpException('Document file is required.', HttpStatus.BAD_REQUEST);
        }
        if (!body.question) {
            throw new HttpException('A question string is required.', HttpStatus.BAD_REQUEST);
        }

        const answer = await this.geminiService.askQuestion(
            file.path,
            file.mimetype,
            body.question,
            file.originalname
        );

        return { answer };
    }
}
