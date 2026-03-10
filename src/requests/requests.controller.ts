import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { ConvertRequestToFileDto } from './dto/convert-request-to-file.dto';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: any) {
    return this.requestsService.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.requestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
    return this.requestsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requestsService.remove(id);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  attachDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File & { buffer: Buffer },
    @CurrentUser() user: any,
  ) {
    return this.requestsService.attachDocument(id, file, user.id);
  }

  @Post(':id/convert-to-file')
  convertToFile(
    @Param('id') id: string,
    @Body() dto: ConvertRequestToFileDto,
    @CurrentUser() user: any,
  ) {
    return this.requestsService.convertToFile(id, dto, user.id);
  }
}
