import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { ILike, Repository } from 'typeorm';
import { OIDCUser } from '../authentication/entities/oidc-user.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
    private logger: Logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(User) public readonly repository: Repository<User>
    ) {}

    public async findOrCreateByKeycloakUserInstance(userInstance: OIDCUser): Promise<User> {
        if(!userInstance) return null;

        // Find in database and return if found
        const user = await this.repository.findOne({ where: { id: userInstance?.sub }});
        if(user) return user;

        // Build new database entry
        const result = new User();
        result.id = userInstance.sub;
        result.name = userInstance.preferred_username;

        // Save entry and return it
        return this.repository.save(result).then((entry) => {
            this.logger.debug(`Registered user ${entry.name}-${entry.id} in database.`);
            return entry;
        }).catch((error) => {
            if(error?.message.startsWith("Duplicate entry")) {
                return this.repository.findOne({ where: { id: userInstance?.sub }})
            }
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

}
