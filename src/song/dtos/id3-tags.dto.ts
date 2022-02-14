
export class ID3TagsDTO {

    public title: string;
    public duration: number;
    public artists: { name: string }[];
    public album: string;
    public artwork: Buffer;
    public titleNrInAlbum: number;

}