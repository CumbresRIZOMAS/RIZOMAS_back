import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { AddFarmMemberDto, CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.users.setStatus(id, active);
  }

  @Post('farms/:farmId/members')
  addFarmMember(@Param('farmId') farmId: string, @Body() dto: AddFarmMemberDto) {
    return this.users.addFarmMember(farmId, dto);
  }
}
