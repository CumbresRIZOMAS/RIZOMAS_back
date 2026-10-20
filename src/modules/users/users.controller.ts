import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(AppRole.ADMIN_CUMBRES, AppRole.ADMIN_FINCA)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) {
    return this.users.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.users.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: RequestUser) {
    return this.users.update(id, dto, user);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentUser() user: RequestUser) {
    return this.users.setStatus(id, dto.active, user);
  }

  @Post(':id/password-reset')
  resetPassword(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.resetPassword(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.remove(id, user);
  }
}
