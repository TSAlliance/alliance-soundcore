
export class UpdatePlaylistCollaboratorsDTO {

    public action: "add" | "remove";
    public collaborators: { id: string }[];

}