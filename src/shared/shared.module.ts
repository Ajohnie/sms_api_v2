import {Global, Module} from '@nestjs/common';
import {RestService} from "./rest/rest.service";

@Global()
@Module({
    providers: [RestService]
})
export class SharedModule {
}
