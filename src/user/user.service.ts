import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { ILike, Repository } from 'typeorm';
import { OIDCUser } from '../authentication/entities/oidc-user.entity';
import { SyncFlag } from '../meilisearch/interfaces/syncable.interface';
import { MeiliUserService } from '../meilisearch/services/meili-user.service';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
    private readonly _logger: Logger = new Logger(UserService.name);

    constructor(
        private readonly meiliClient: MeiliUserService,
        @InjectRepository(User) public readonly repository: Repository<User>
    ) {}

    public async findById(userId: string): Promise<User> {
        return this.repository.createQueryBuilder("user")
            .leftJoinAndSelect("user.artwork", "artwork")
            .where("user.id = :userId", { userId })
            .getOne();
    }

    public async findOrCreateByKeycloakUserInstance(userInstance: OIDCUser): Promise<User> {
        if(!userInstance) return null;

        // Find in database and return if found
        const existingUser = await this.findById(userInstance.sub);
        if(existingUser) {
            if(this.hasUpdated(userInstance, existingUser)) {
                // Update username (currently the only thing that can change which is important)
                existingUser.name = userInstance.preferred_username;
                return this.repository.save(existingUser).then((result) => {
                    // Sync with meilisearch if user was updated.
                    return this.syncWithMeili(result);
                }).catch((error) => {
                    this._logger.error(`Could not update user object, using old account data: ${error.message}`, error.stack);
                    return existingUser;
                })
            }

            // Update user in meilisearch
            if(this.meiliClient.isSyncRecommended(existingUser)) {
                this.syncWithMeili(existingUser);
            }
            
            return existingUser
        }

        // Build new database entry
        const user = new User();
        user.id = userInstance.sub;
        user.name = userInstance.preferred_username;

        return this.repository.save(user).then((result) => {
            return this.syncWithMeili(result);
        });
    }

    /**
     * Update the sync flag of an user.
     * @param idOrObject Id or object of the user
     * @param flag Updated sync flag
     * @returns User
     */
    public async setSyncFlag(idOrObject: string | User, flag: SyncFlag): Promise<User> {
        const user = await this.resolveUser(idOrObject);
        if(!user) return null;

        user.lastSyncedAt = new Date();
        user.lastSyncFlag = flag;
        return this.repository.save(user);
    }

    /**
     * Resolve an id or object to an user object.
     * @param idOrObject User id or object
     * @returns User
     */
     protected async resolveUser(idOrObject: string | User): Promise<User> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    /**
     * Synchronize the corresponding document on meilisearch.
     * @param user User data
     * @returns User
     */
    private async syncWithMeili(user: User) {
        return this.meiliClient.setUser(user).then(() => {
            return this.setSyncFlag(user, SyncFlag.OK);
        }).catch(() => {
            return this.setSyncFlag(user, SyncFlag.ERROR);
        });
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<User>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        const result = await this.repository.findAndCount({ where: { name: ILike(query) }, skip: pageable.page * pageable.size, take: pageable.size});
        return Page.of(result[0], result[1], pageable.page);
    }

    private hasUpdated(userInstance: OIDCUser, existingUser: User): boolean {
        if(userInstance.sub != existingUser.id) return false;
        return userInstance.preferred_username !== existingUser.name;
    }

}
