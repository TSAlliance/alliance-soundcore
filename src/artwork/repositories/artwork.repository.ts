import { EntityRepository, Repository } from "typeorm";
import { Artwork } from "../entities/artwork.entity";

@EntityRepository(Artwork)
export class ArtworkRepository extends Repository<Artwork> {

    

}