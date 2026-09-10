export function isAIRecommendFeatureDisabled(): boolean {
  return true;
}
export async function sendAIRecommendMessage(..._args: any[]): Promise<any> {
  throw new Error('AI recommend removed');
}
