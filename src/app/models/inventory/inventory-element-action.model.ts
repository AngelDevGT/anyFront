import { ActionType } from '../auxiliary/action-type.model';
import { Element } from '../auxiliary/element.model';
import { Measure } from '../auxiliary/measure.model';
import { User } from '../system/user.model';

export class InventoryElementAction {
    id?: string;
    actionType?: ActionType;
    reason?: string;
    element?: Element;
    price?: string;
    measure?: Measure;
    quantity?: string;
    creatorUser?: User;
    creationDate?: string;
}