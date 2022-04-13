import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SoundcoreMeiliService } from '@soundcore/soundcore-meili';
import { MeiliUser } from '@soundcore/soundcore-meili/entities/meili-user';
import { MeiliSearchError } from 'meilisearch';
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
        private readonly artworkService: ArtworkService,
        private readonly meiliservice: SoundcoreMeiliService,
        private readonly userRepository: UserRepository,
        private readonly eventEmitter: EventEmitter2
    ) {}

    public async findOrCreateByKeycloakUserInstance(userInstance: KeycloakUser): Promise<User> {
        if(!userInstance) return null;

        // Find in database and return if found
        let user = await this.userRepository.findOne({ where: { id: userInstance?.sub }});
        if(!user){
            // Build new database entry
            const result = new User();
            result.id = userInstance.sub;
            result.username = userInstance.preferred_username;

            // Save entry and return it
            user = await this.userRepository.save(result).then((u) => {
                this.eventEmitter.emit("user.created", u);
                return u;
            }).catch((error) => {
                if(error?.message.startsWith("Duplicate entry")) {
                    return this.userRepository.findOne({ where: { id: userInstance?.sub }})
                }
            });
        } else {
            if(userInstance.preferred_username != user.username) {
                // Build new user object
                const result = new User();
                result.id = userInstance.sub;
                result.username = userInstance.preferred_username;

                user = await this.userRepository.save(result).then((u) => {
                    this.eventEmitter.emit("user.updated", u);
                    return u;
                })
            }
        }

        this.meiliservice.userIndex().getDocument(user.id).catch((error: MeiliSearchError) => {
            if(error["code"] == "document_not_found") {
                this.meiliservice.userIndex().addDocuments([{
                    id: user.id,
                    username: user.username
                }])
            }
        })

        return user;
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

    public async findBySearchQuery(query: string, pageable: Pageable) {
        /*if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }*/

        return this.meiliservice.userIndex().search<MeiliUser>(query, {
            offset: pageable.size * pageable.page,
            limit: pageable.size
        })

        // return this.userRepository.findAll(pageable, { where: { username: ILike(query) }})
    }

}
