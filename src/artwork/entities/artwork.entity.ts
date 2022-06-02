
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Mount } from "../../mount/entities/mount.entity";

export enum ArtworkType {
    SONG = 0,
    ALBUM,
    PLAYLIST,
    ARTIST,
    PUBLISHER,
    LABEL,
    DISTRIBUTOR,
    BANNER
}

export enum ArtworkFlag {
    OK = 0,
    PROCESSING,
    ERROR,
}

export class ArtworkColors {
    /**
     *  Formerly used as accentColor
     */ 
    public vibrant: string;

    public darkMuted: string;
    public darkVibrant: string;
    public lightMuted: string;
    public lightVibrant: string;
    public muted: string;
}

@Entity()
export class Artwork {
    
    @PrimaryGeneratedColumn("uuid")
    public id: string;
    
    @Column({ type: "tinyint", default: 0 })
    public type: ArtworkType;

    @Column({ type: "json", nullable: true })
    public colors: ArtworkColors;

    @Index({ unique: true })
    @Column()
    public name: string;

    @CreateDateColumn()
    public createdAt: Date;

    @Column()
    public writtenAt: Date;

    @Column({ type: "tinyint", default: 0 })
    public flag: ArtworkFlag;

    // Prevent duplicate files by specifying filename
    // This also applies to externalImages even if they haven't been downloaded
    // (because they could be downloaded in future)
    
    @ManyToOne(() => Mount, { onDelete: "CASCADE" })
    @JoinColumn()
    public mount: Mount;

}