export function hasValidRange(startDate: Date, endDate: Date): boolean {
  return endDate.getTime() > startDate.getTime();
}
