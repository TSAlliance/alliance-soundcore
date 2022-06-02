import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job, Queue } from "bull";
import { QUEUE_ARTWORKWRITE_NAME } from "../../constants";
import { ArtworkProcessDTO } from "../dtos/artwork-process.dto";
import { CreateArtworkDTO } from "../dtos/create-artwork.dto";
import { Artwork, ArtworkFlag } from "../entities/artwork.entity";
import { ArtworkRepository } from "../repositories/artwork.repository";

@Injectable()
export class ArtworkService {

    constructor(
        private readonly repository: ArtworkRepository,
        @InjectQueue(QUEUE_ARTWORKWRITE_NAME) private readonly queue: Queue<ArtworkProcessDTO>
    ) {
        this.queue.on("active", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.PROCESSING));
        this.queue.on("completed", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.OK));
        this.queue.on("failed", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.ERROR));
    }

    /**
     * Find an artwork by its id.
     * Included relations: Mount(id, name, directory)
     * @param artworkId 
     * @returns 
     */
    public async findById(artworkId: string): Promise<Artwork> {
        return this.repository.createQueryBuilder("artwork")
            .leftJoin("artwork.mount", "mount")
            .addSelect(["mount.id", "mount.name", "mount.directory"])
            .where("artwork.id = :artworkId", { artworkId })
            .getOne();
    }

    /**
     * Find an artwork or create it if it does not exist.
     * For finding the artwork, only the "name", "type" and "mount" properties
     * of the createArtworkDto object are used.
     * NOTE: This operation is not atomic
     * @param createArtworkDto Creation and Find options
     * @returns Artwork
     */
    public async findOrCreateArtwork(createArtworkDto: CreateArtworkDTO): Promise<Artwork> {
        return this.repository.manager.transaction((manager) => {
            return manager.findOne(Artwork, { name: createArtworkDto.name, type: createArtworkDto.type, mount: { id: createArtworkDto.mount.id }}).then((result) => {
                if(typeof result == "undefined" || result == null) {
                    return this.create(createArtworkDto);
                }

                return result;
            });
        });
    }

    /**
     * Create new artwork file in database.
     * If the "writeSource" property is set, the created
     * artwork will be added to the write-queue.
     * @param createArtworkDto Creation options
     * @returns Artwork
     */
    public async create(createArtworkDto: CreateArtworkDTO): Promise<Artwork> {
        const artwork = new Artwork();
        artwork.flag = ArtworkFlag.OK;
        artwork.name = createArtworkDto.name;
        artwork.type = createArtworkDto.type;
        artwork.mount = createArtworkDto.mount;

        return this.repository.save(artwork).then((result) => {
            if(createArtworkDto.writeSource) {
                this.createWriteJob(createArtworkDto.writeSource, result)
            }

            return result;
        });
    }

    /**
     * This function will create a job for writing a new artwork file.
     * The created job will be returned to watch for its completion state if needed.
     * @param srcFile File that should be written to an artwork.
     * @param artwork Artwork entity
     * @returns Job<ArtworkProcessDTO>
     */
    public async createWriteJob(srcFile: string, artwork: Artwork): Promise<Job<ArtworkProcessDTO>> {
        return this.queue.add(new ArtworkProcessDTO(artwork, srcFile));
    }

    /**
     * Update an artworks flag in the database.
     * @param idOrObject Id or Artwork object
     * @param flag ArtworkFlag
     * @returns Artwork
     */
    private async setFlag(idOrObject: string | Artwork, flag: ArtworkFlag): Promise<Artwork> {
        const artwork = await this.resolveArtwork(idOrObject);

        // Check if the flag actually changed.
        // If not, do nothing and return.
        if(artwork.flag == flag) return artwork;

        // Update the flag
        artwork.flag = flag;
        return this.repository.save(artwork);
    }

    /**
     * Resolve the parameter to an artwork entity.
     * If its a string, the parameter is considered an id and the matching
     * entry from the database will be returned.
     * If its an object, the parameter is considered the artwork object which
     * will just be returned.
     * @param idOrObject Id or Artwork object
     * @returns Artwork
     */
    private async resolveArtwork(idOrObject: string | Artwork): Promise<Artwork> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject as Artwork;
    }


}