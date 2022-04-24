import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Notification } from "../entities/notification.entity";

@EntityRepository(Notification)
export class NotificationRepository extends PageableRepository<Notification> {}