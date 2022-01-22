import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SSOService, SSOUser } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class UserService {
    private logger: Logger = new Logger(UserService.name);

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

    public async createIfNotExists(user: SSOUser) {
        return this.userRepository.findOne({ where: { id: user.id }}).then((result) => {
            // Create new user in database if there is no existing one for this id.
            if(!result) {
              return this.userRepository.save(user).catch(() => {
                this.logger.warn("Could not save user info.")
              })
            } else {
              // Update user in database if username has changed.
              if(user.username != result.username || user.avatarResourceId != result.avatarResourceId) {
                return this.userRepository.save(user).catch(() => {
                  this.logger.warn("Could not save user info.")
                })
              }
            }
        }).catch(() => {
            this.logger.warn("Could not save user info.")
        })
    }

}
