import { RandomUtil } from "@tsalliance/rest";

export class Slug {

    public static create(input: string, length = 120): string {
        input = `${input.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}`

        if(input.length > length) {
            return input.substring(0, length) + "-" + RandomUtil.randomString(6);
        } else {
            return input + "-" + RandomUtil.randomString(6);
        }
    }


}