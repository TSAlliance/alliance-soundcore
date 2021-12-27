import { Injectable } from '@nestjs/common';
import { Label } from './entities/label.entity';
import { LabelRepository } from './repositories/label.repository';

@Injectable()
export class LabelService {

    constructor(private lableRepository: LabelRepository){}

    public async createIfNotExists(name: string, geniusId?: string): Promise<Label> {
        const label: Label = await this.lableRepository.findOne({ where: { name }})
        if(label) return label;

        return this.lableRepository.save({
            name,
            geniusId
        })
    }

}
