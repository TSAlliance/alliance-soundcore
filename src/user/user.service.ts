import { Injectable, NotFoundException } from '@nestjs/common';
import { SSOService } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class UserService {

    constructor(
        private ssoService: SSOService,
        private userRepository: UserRepository
    ) {}

    public async findProfileById(userId: string, accessToken: string): Promise<User> {
        const userInfo = await this.ssoService.findUserUsingHeader(userId, accessToken);
        const user = await this.userRepository.findOne({ where: { id: userId }});

        if(!userInfo) throw new NotFoundException("User not found.")
        if(!user) {
            // Simulate user

            const user: User = userInfo as User
            return user;
        }

        return { ...user, ...userInfo } as User;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<User>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.userRepository.findAll(pageable, { where: { username: ILike(query) }})
    }

}
