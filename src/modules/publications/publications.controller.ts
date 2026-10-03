import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicationsService } from './publications.service';
import { CreatePublicationDto, PublishPublicationDto } from './dto/publication.dto';

@Controller('publications')
export class PublicationsController {
  constructor(private readonly publications: PublicationsService) {}

  @Post()
  create(@Body() dto: CreatePublicationDto) {
    return this.publications.create(dto);
  }

  @Patch(':id/status')
  publish(@Param('id') id: string, @Body() dto: PublishPublicationDto) {
    return this.publications.publish(id, dto);
  }

  @Public()
  @Get()
  findPublished() {
    return this.publications.findPublished();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.publications.findOne(id);
  }
}
