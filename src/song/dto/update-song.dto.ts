import { PartialType } from "@nestjs/mapped-types";
import { CreateSongDTO } from "./create-song.dto";

export class UpdateSongDTO extends PartialType(CreateSongDTO) {}