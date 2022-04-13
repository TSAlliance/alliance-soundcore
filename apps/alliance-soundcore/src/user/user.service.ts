import { Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { ArtworkService } from '../artwork/artwork.service';
import { KeycloakUser } from '../authentication/entities/keycloak-user.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class UserService {
    private logger: Logger = new Logger(UserService.name);

    constructor(
        private artworkService: ArtworkService,
        private userRepository: UserRepository
    ) {}

    public async findOrCreateByKeycloakUserInstance(userInstance: KeycloakUser): Promise<User> {
        if(!userInstance) return null;

        // Find in database and return if found
        const user = await this.userRepository.findOne({ where: { id: userInstance?.sub }});
        if(user) return user;

        // Build new database entry
        const result = new User();
        result.id = userInstance.sub;
        result.username = userInstance.preferred_username;

        // Save entry and return it
        return this.userRepository.save(result).catch((error) => {
            if(error?.message.startsWith("Duplicate entry")) {
                return this.userRepository.findOne({ where: { id: userInstance?.sub }})
            }
        });
    }

    /*public async findProfileById(userId: string, accessToken: string): Promise<User> {
        const userInfo = await this.ssoService.findUserUsingHeader(userId, accessToken);
        const user = await this.userRepository.findOne({ where: { id: userId }});

        if(!userInfo) throw new NotFoundException("User not found.")
        if(!user) {
            // Simulate user

            // const user: User = userInfo as User
            // return user;
        }

        // return { ...user, ...userInfo } as User;
    }*/

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<User>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.userRepository.findAll(pageable, { where: { username: ILike(query) }})
    }

}
