import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Activity } from "../entities/activity.entity";

@EntityRepository(Activity)
export class ActivityRepository extends PageableRepository<Activity> {}