import { Controller, Post, UseInterceptors, UploadedFile, Body, Res, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('PDF Tools')
@Controller('pdf')
export class PdfController {
    constructor(private readonly pdfService: PdfService) { }

    @Post('compress')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Compress a PDF file using Ghostscript' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                quality: { type: 'number', description: 'Quality ratio 1-100' },
            },
        },
    })
    async compressPdf(
        @UploadedFile() file: Express.Multer.File,
        @Body('quality') quality: string,
        @Res() res: Response,
    ) {
        if (!file) {
            throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
        }

        try {
            const qNum = parseInt(quality, 10) || 60;
            const compressedBuffer = await this.pdfService.compressPdf(file.buffer, qNum);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="compressed_${file.originalname}"`,
                'Content-Length': compressedBuffer.length,
            });

            res.send(compressedBuffer);
        } catch (error) {
            throw new HttpException(
                `Compression failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
