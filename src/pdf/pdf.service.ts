import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

@Injectable()
export class PdfService {
    private readonly logger = new Logger(PdfService.name);

    async compressPdf(buffer: Buffer, quality: number): Promise<Buffer> {
        const tmpDir = path.join(os.tmpdir(), `pdf_compress_${uuidv4()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        const inputPath = path.join(tmpDir, 'input.pdf');
        const outputPath = path.join(tmpDir, 'output.pdf');

        fs.writeFileSync(inputPath, buffer);

        try {
            // Map quality to Ghostscript settings
            // /screen: 72dpi, /ebook: 150dpi, /printer: 300dpi, /prepress: best
            let gsSetting = '/ebook';
            if (quality <= 30) gsSetting = '/screen';
            else if (quality <= 60) gsSetting = '/ebook';
            else if (quality <= 85) gsSetting = '/printer';
            else gsSetting = '/prepress';

            this.logger.log(`Compressing PDF with Ghostscript setting: ${gsSetting} (Quality: ${quality}%)`);

            // Ghostscript command
            const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${gsSetting} -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${inputPath}`;

            await execPromise(cmd);

            if (!fs.existsSync(outputPath)) {
                throw new Error('Ghostscript failed to create output file');
            }

            const compressedBuffer = fs.readFileSync(outputPath);

            this.logger.log(`Compression successful: ${buffer.length} -> ${compressedBuffer.length} bytes`);

            return compressedBuffer;
        } catch (error) {
            this.logger.error(`Ghostscript compression failed: ${error.message}`);
            throw error;
        } finally {
            // Cleanup
            try {
                if (fs.existsSync(tmpDir)) {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                }
            } catch (err) {
                this.logger.warn(`Failed to cleanup temp dir: ${tmpDir}`);
            }
        }
    }
}
