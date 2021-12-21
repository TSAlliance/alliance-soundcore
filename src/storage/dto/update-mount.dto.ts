import { PartialType } from "@nestjs/mapped-types";
import { CreateMountDTO } from "./create-mount.dto";

export class UpdateMountDTO extends PartialType(CreateMountDTO) {
}