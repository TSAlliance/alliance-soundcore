import { Controller, Get, Post } from "@nestjs/common";
import { AuthenticatedUser } from "nest-keycloak-connect";
import { Pageable } from "nestjs-pager";
import { User } from "../../user/entities/user.entity";
import { NotificationService } from "../services/notification.service";

@Controller("notifications")
export class NotificationController {

    constructor(private readonly notificationService: NotificationService) {}

    @Get("@me")
    public async findByCurrentUser(@AuthenticatedUser() authentication: User, @Pageable() pageable: Pageable) {
        return this.notificationService.findByCurrentUser(authentication, pageable);
    }

    @Post("test")
    public async sendTest() {
        console.log("sending test")
        return this.notificationService.createNotification({
            title: "This is a test",
            message: "This notification was just a test to see how the system works.",
            isBroadcast: true
        })
    }

}