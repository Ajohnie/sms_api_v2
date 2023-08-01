export * from "./levels-stream-saved.event";
export * from "./levels-stream-deleted.event";

export enum LevelsStreamEvents {
  "SAVE" = "levelsStream.saved",
  "DELETE" = "levelsStream.deleted"
}