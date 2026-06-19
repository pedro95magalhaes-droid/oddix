import { Controller, Get, Query } from "@nestjs/common";
import { VirtualService } from "./virtual.service";

@Controller("virtual")
export class VirtualController {
  constructor(private readonly virtualService: VirtualService) {}

  @Get("leagues")
  getLeagues() {
    return this.virtualService.getLeagues();
  }

  @Get("upcoming")
  getUpcoming(@Query("league") league = "euro") {
    return this.virtualService.getUpcoming(league);
  }

  @Get("history")
  getHistory(
    @Query("league") league = "euro",
    @Query("limit") limit = "100",
  ) {
    return this.virtualService.getHistory(league, Number(limit || 100));
  }

  @Get("patterns")
  getPatterns(
    @Query("league") league = "euro",
    @Query("limit") limit = "300",
  ) {
    return this.virtualService.getPatterns(league, Number(limit || 300));
  }

  @Get("top-picks")
  getTopPicks(
    @Query("league") league = "euro",
    @Query("historyLimit") historyLimit = "300",
  ) {
    return this.virtualService.getTopPicks(league, Number(historyLimit || 300));
  }

  @Get("last-updated")
  getLastUpdated(@Query("league") league = "euro") {
    return this.virtualService.getLastUpdated(league);
  }
}
