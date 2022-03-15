import { Controller, Get } from "@nestjs/common";
import { AuthenticatedUser } from "nest-keycloak-connect";
import { User } from "../../user/entities/user.entity";
import { CollectionService } from "../services/collection.service";

@Controller("collections")
export class CollectionController {

    constructor(private collectionService: CollectionService) {}

    @Get()
    public async findByCurrentUser(@AuthenticatedUser() user: User) {
        return this.collectionService.findByUserId(user?.id)
    }

    /*@Get("/byArtist/:artistId")
    public async findByArtist(@Param("artistId") artistId: string, @AuthenticatedUser() user: User) {
        return this.collectionService.findByUserId(user?.id)
    }*/

}