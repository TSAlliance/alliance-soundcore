import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Label } from "../entities/label.entity";

@EntityRepository(Label)
export class LabelRepository extends PageableRepository<Label> {}