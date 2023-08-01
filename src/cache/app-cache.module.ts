import { CacheModule, Module } from "@nestjs/common";
import { CacheService } from "./cache.service";

@Module({
  controllers: [],
  imports: [CacheModule.register()],
  providers: [CacheService],
  exports: [CacheService]
})
export class AppCacheModule {
}
