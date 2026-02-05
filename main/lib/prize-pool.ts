import { kv } from "@vercel/kv";
import { getWeekNumber } from "./leaderboard";

/**
 * Prize Pool tracking sistemi
 * Her tournament entry pool'a eklenir
 * Haftalık dağıtım sonrası sıfırlanır
 */

/**
 * Pool'a USDC ekle (tournament entry yapıldığında)
 */
export async function addToPrizePool(amount: number): Promise<void> {
  const weekNumber = getWeekNumber();
  const key = `prize-pool:week:${weekNumber}`;
  
  const currentPool = await kv.get<number>(key) || 0;
  const newPool = currentPool + amount;
  
  await kv.set(key, newPool);
}

/**
 * Mevcut haftalık pool miktarını getir
 */
export async function getCurrentPrizePool(): Promise<number> {
  const weekNumber = getWeekNumber();
  const key = `prize-pool:week:${weekNumber}`;
  
  const pool = await kv.get<number>(key);
  return pool || 0;
}

/**
 * Pool'u sıfırla (dağıtım sonrası)
 */
export async function resetPrizePool(): Promise<void> {
  const weekNumber = getWeekNumber();
  const key = `prize-pool:week:${weekNumber}`;
  
  await kv.del(key);
}

/**
 * Geçmiş hafta pool'unu getir
 */
export async function getPastWeekPool(weekNumber: number): Promise<number> {
  const key = `prize-pool:week:${weekNumber}`;
  const pool = await kv.get<number>(key);
  return pool || 0;
}
