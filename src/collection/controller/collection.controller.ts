import { Controller, Get } from "@nestjs/common";
import { Authentication, IsAuthenticated } from "@tsalliance/sso-nest";
import { User } from "../../user/entities/user.entity";
import { CollectionService } from "../services/collection.service";

@Controller("collections")
export class CollectionController {

    constructor(private collectionService: CollectionService) {}

    @Get()
    @IsAuthenticated()
    public async findByCurrentUser(@Authentication() user: User) {
        return this.collectionService.findByUserId(user.id)
    }

    /*@Get("/byArtist/:artistId")
    @IsAuthenticated()
    public async findByArtist(@Param("artistId") artistId: string, @Authentication() user: User) {
        return this.collectionService.findByUserId(user.id)
    }*/

}